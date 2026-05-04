# frozen_string_literal: true

class Api::Internal::AiProductPageDraftsController < Api::Internal::BaseController
  include Throttling

  before_action :authenticate_user!
  before_action :throttle_ai_requests
  after_action :verify_authorized

  AI_REQUESTS_PER_PERIOD = 10
  AI_REQUESTS_PERIOD_WINDOW = 1.hour
  private_constant :AI_REQUESTS_PER_PERIOD, :AI_REQUESTS_PERIOD_WINDOW

  def create
    authorize current_seller, :generate_product_details_with_ai?

    payload = draft_params
    product = payload.fetch(:product, {})
    quiz = payload.fetch(:quiz, {})

    begin
      service = ::Ai::ProductDetailsGeneratorService.new(current_seller:)
      result = service.generate_product_page_draft(product:, quiz:)

      render json: {
        success: true,
        data: result
      }
    rescue => e
      Rails.logger.error "Product page draft generation using AI failed: #{e.full_message}"
      ErrorNotifier.notify(e)
      render json: {
        success: false,
        error: "Failed to generate product page draft. Please try again."
      }, status: :internal_server_error
    end
  end

  private
    def throttle_ai_requests
      return unless current_user

      key = RedisKey.ai_request_throttle(current_seller.id)
      throttle!(key:, limit: AI_REQUESTS_PER_PERIOD, period: AI_REQUESTS_PERIOD_WINDOW)
    end

    def draft_params
      params
        .permit(
          product: [:name, :description, :receipt_button_text, :receipt_custom_message, { rich_content_section_titles: [] }],
          quiz: [:business_summary, :audience, :pricing_shape, :tone, :delivery_notes, :generation_tick, { value_drivers: [] }]
        )
        .to_h
        .deep_symbolize_keys
    end
end
