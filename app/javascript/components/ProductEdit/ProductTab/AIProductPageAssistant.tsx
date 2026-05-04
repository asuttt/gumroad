import { Sparkle } from "@boxicons/react";
import * as React from "react";

import GuidGenerator from "$app/utils/guid_generator";
import { request } from "$app/utils/request";

import { Button } from "$app/components/Button";
import { Modal } from "$app/components/Modal";
import { useProductEditContext } from "$app/components/ProductEdit/state";
import { Alert } from "$app/components/ui/Alert";
import { Card, CardContent } from "$app/components/ui/Card";
import { Fieldset, FieldsetDescription, FieldsetTitle } from "$app/components/ui/Fieldset";
import { Input } from "$app/components/ui/Input";
import { Label } from "$app/components/ui/Label";
import { Tab, Tabs } from "$app/components/ui/Tabs";
import { Textarea } from "$app/components/ui/Textarea";

const stripHtml = (value: string) =>
  value
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

const escapeHtml = (value: string) =>
  value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");

const truncate = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, maxLength).trimEnd()}…` : value;

const extractAudience = (value: string) => {
  const pattern = /\b(?:for|to)\s+([^.,;:!?]+)(?:[.,;:!?]|$)/iu;
  const match = pattern.exec(value);
  return match?.[1]?.trim();
};

const joinWithCommas = (values: string[]) =>
  values.length <= 1 ? (values[0] ?? "") : `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;

const valueDriverOptions = ["Speed", "Trust", "Transformation", "Quality", "Convenience", "Price", "Exclusivity"];

const pricingOptions = ["One price", "Multiple tiers", "Quote/custom", "Not sure yet"];

const inferPriceSuggestion = (title: string, description: string, note: string, isCoffee: boolean) => {
  const haystack = `${title} ${description} ${note}`.toLowerCase();
  if (isCoffee) return "Consider $12-$39";
  if (/\b(service|consulting|audit|done-for-you|strategy)\b/u.test(haystack)) return "Consider $149-$499";
  if (/\b(course|masterclass|bootcamp|workshop|lesson)\b/u.test(haystack)) return "Consider $49-$149";
  if (/\b(template|notion|checklist|prompt|swipe|guide|ebook)\b/u.test(haystack)) return "Consider $19-$79";
  if (/\b(software|app|tool|widget|plugin)\b/u.test(haystack)) return "Consider $29-$99";
  return "Consider $29-$79";
};

export type BuildWithAIDraft = {
  product: {
    title: string;
    description: string;
    bullets: string[];
    priceSuggestion: string;
  };
  content: {
    outline: string;
    sectionIdeas: string[];
    existingSections: string[];
    pages: {
      id: string;
      title: string;
      description: object;
      updated_at: string;
    }[];
  };
  receipt: {
    buttonText: string;
    customMessage: string;
  };
  rationale: string;
  missingInfo: string[];
};

type BuildWithAIApiResponse =
  | {
      success: true;
      data: BuildWithAIDraft;
    }
  | {
      success: false;
      error: string;
    };

const isBuildWithAIApiResponse = (value: unknown): value is BuildWithAIApiResponse => {
  if (!value || typeof value !== "object") return false;
  return "success" in value;
};

const buildDraft = ({
  title,
  description,
  businessSummary,
  audience,
  valueDrivers,
  pricingShape,
  tone,
  deliveryNotes,
  generationTick,
  currentContentSections,
  currentReceiptButton,
  currentReceiptMessage,
  isCoffee,
}: {
  title: string;
  description: string;
  businessSummary: string;
  audience: string;
  valueDrivers: string[];
  pricingShape: string;
  tone: string;
  deliveryNotes: string;
  generationTick: number;
  currentContentSections: string[];
  currentReceiptButton: string;
  currentReceiptMessage: string;
  isCoffee: boolean;
}): BuildWithAIDraft => {
  const cleanTitle = title.trim() || "Your product";
  const cleanDescription = stripHtml(description);
  const summary = businessSummary.trim() || cleanDescription || cleanTitle;
  const audienceText = audience.trim() || extractAudience(summary) || "your ideal buyers";
  const valueDriverText = valueDrivers.length ? joinWithCommas(valueDrivers.map((value) => value.toLowerCase())) : "";
  const pricingText = pricingShape.trim();
  const toneText = tone.trim() || "clear, credible, and easy to act on";
  const deliveryText = deliveryNotes.trim();
  const productFocus = truncate(summary, 120);
  const toneVariant = generationTick % 2 === 0 ? toneText : `${toneText}, but simpler`;
  const proofLine = deliveryText
    ? `It frames the offer around ${truncate(deliveryText, 90)} so buyers understand the outcome faster.`
    : "It makes the offer easier to scan and gives buyers a sharper reason to buy.";

  const productTitle =
    cleanTitle.toLowerCase().includes(audienceText.toLowerCase()) || !audienceText
      ? cleanTitle
      : truncate(`${cleanTitle} for ${audienceText}`, 64);

  const productDescription = isCoffee
    ? [`Built for ${audienceText}.`, `Tone: ${toneText}.`, productFocus, proofLine].filter(Boolean).join("\n\n")
    : [
        `<p><strong>Built for ${escapeHtml(audienceText)}.</strong> This version keeps the promise direct, benefits visible, and the tone ${escapeHtml(toneVariant)}.</p>`,
        `<p>${escapeHtml(proofLine)} It keeps the core idea of ${escapeHtml(truncate(cleanDescription || cleanTitle, 90))} while making the page easier to skim.</p>`,
      ].join("");

  const productBullets = [
    `Clearer promise for ${audienceText}`,
    valueDriverText ? `Messaging leans into ${valueDriverText}` : null,
    pricingText ? `Structured for ${pricingText.toLowerCase()}` : null,
    `Tighter framing around ${truncate(productFocus, 42)}`,
    `Skimmable benefits that make the value obvious`,
    deliveryText
      ? `Aligned to the buyer outcome: ${truncate(deliveryText, 40)}`
      : "Stronger support for the page's preview and checkout scan",
  ].filter((value): value is string => Boolean(value));

  const contentSectionIdeas = [
    `Start here: what ${truncate(cleanTitle, 40)} helps buyers do`,
    `What's included: the core files, lessons, or pages`,
    `Quick start: the fastest path to first value`,
    `FAQ: common objections and what happens after purchase`,
  ];
  const updatedAt = new Date().toISOString();
  const contentPages = [
    {
      id: GuidGenerator.generate(),
      title: "Start here",
      description: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: `This is for ${audienceText}.` }] }],
      },
      updated_at: updatedAt,
    },
    {
      id: GuidGenerator.generate(),
      title: "What’s included",
      description: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: contentSectionIdeas.slice(0, 3).join(" • ") }] },
        ],
      },
      updated_at: updatedAt,
    },
    {
      id: GuidGenerator.generate(),
      title: "FAQ",
      description: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "What happens after purchase?" }] },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text:
                  currentReceiptMessage.trim() ||
                  "Buyers get immediate access and can start with the quick-start guidance inside.",
              },
            ],
          },
        ],
      },
      updated_at: updatedAt,
    },
  ];

  const receiptButtonText =
    currentReceiptButton.trim() ||
    truncate(`View your ${summary.toLowerCase().includes("content") ? "content" : "purchase"}`, 26);
  const receiptCustomMessage =
    currentReceiptMessage.trim() ||
    `Thanks for buying ${cleanTitle}. Start with the first step, then follow the quick-start guidance inside.`;

  return {
    product: {
      title: productTitle,
      description: productDescription,
      bullets: productBullets,
      priceSuggestion: inferPriceSuggestion(
        cleanTitle,
        cleanDescription,
        `${businessSummary} ${audience} ${valueDrivers.join(" ")} ${pricingShape} ${tone} ${deliveryNotes}`,
        isCoffee,
      ),
    },
    content: {
      outline: `A lightweight structure that keeps the buying journey simple for ${audienceText}`,
      sectionIdeas: contentSectionIdeas,
      existingSections: currentContentSections.length
        ? currentContentSections
        : ["No existing content yet, so the agent would start a first draft outline"],
      pages: contentPages,
    },
    receipt: {
      buttonText: truncate(receiptButtonText, 26),
      customMessage: receiptCustomMessage,
    },
    rationale: `It aligns the product page, content delivery, and receipt flow around ${audienceText}, which makes the whole experience feel more deliberate and easier to buy from`,
    missingInfo: [
      businessSummary.trim() ? null : "Add a short business summary to make the draft sharper",
      audience.trim() ? null : "Call out the exact audience for a stronger messaging",
      valueDrivers.length ? null : "Choose what buyers should care about most",
      pricingShape.trim() ? null : "Choose a rough pricing shape",
      deliveryNotes.trim() ? null : "Add delivery notes so the content and receipt can match the promise",
    ].filter((value): value is string => Boolean(value)),
  };
};

const SectionCard = ({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) => (
  <Card className="border-border/80 shadow-none">
    <CardContent details className="grid justify-normal gap-3 p-4">
      <div className="grid gap-1">
        <div className="text-xs font-medium tracking-wide text-muted uppercase">{eyebrow}</div>
        <div className="text-sm font-bold">{title}</div>
      </div>
      {children}
    </CardContent>
  </Card>
);

export const AIProductPageAssistant = ({ onApply }: { onApply: (draft: BuildWithAIDraft) => void }) => {
  const uid = React.useId();
  const [open, setOpen] = React.useState(false);
  const [hasGenerated, setHasGenerated] = React.useState(false);
  const [generatedDraft, setGeneratedDraft] = React.useState<BuildWithAIDraft | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [previewSource, setPreviewSource] = React.useState<"local" | "api" | null>(null);
  const [generationTick, setGenerationTick] = React.useState(0);
  const [quizStep, setQuizStep] = React.useState(0);
  const [businessSummary, setBusinessSummary] = React.useState("");
  const [audience, setAudience] = React.useState("");
  const [valueDrivers, setValueDrivers] = React.useState<string[]>([]);
  const [pricingShape, setPricingShape] = React.useState("");
  const [tone, setTone] = React.useState("");
  const [deliveryNotes, setDeliveryNotes] = React.useState("");
  const [previewTab, setPreviewTab] = React.useState<"product" | "content" | "receipt">("product");

  const { product } = useProductEditContext();
  const isCoffee = product.native_type === "coffee";
  const currentContentSections = React.useMemo(
    () =>
      product.rich_content
        .map((page) => stripHtml(page.title ?? ""))
        .filter(Boolean)
        .slice(0, 5),
    [product.rich_content],
  );

  const buildDraftFromState = React.useCallback(
    (tick: number) =>
      buildDraft({
        title: product.name,
        description: product.description,
        businessSummary,
        audience,
        valueDrivers,
        pricingShape,
        tone,
        deliveryNotes,
        generationTick: tick,
        currentContentSections,
        currentReceiptButton: product.custom_view_content_button_text ?? "",
        currentReceiptMessage: product.custom_receipt_text ?? "",
        isCoffee,
      }),
    [
      product.name,
      product.description,
      businessSummary,
      audience,
      valueDrivers,
      pricingShape,
      tone,
      deliveryNotes,
      currentContentSections,
      product.custom_view_content_button_text,
      product.custom_receipt_text,
      isCoffee,
    ],
  );
  const fallbackDraft = React.useMemo(() => buildDraftFromState(generationTick), [buildDraftFromState, generationTick]);
  const draft = generatedDraft ?? fallbackDraft;

  const intakeSteps = [
    {
      eyebrow: "Step 1 of 4",
      title: "Start with the product or service",
      description: "One clear sentence is fine",
    },
    {
      eyebrow: "Step 2 of 4",
      title: "Choose the audience",
      description: "Target demographic for your product or service",
    },
    {
      eyebrow: "Step 3 of 4",
      title: "Pick what they should care about",
      description: "Choose the main reason to buy",
    },
    {
      eyebrow: "Step 4 of 4",
      title: "Add optional details",
      description: "A few light constraints before preview",
    },
  ];
  const currentStep = intakeSteps[quizStep] ?? {
    eyebrow: "Step 1 of 4",
    title: "Start with the product or service",
    description: "One clear sentence is fine",
  };
  const canContinue =
    quizStep === 0
      ? businessSummary.trim().length > 0
      : quizStep === 1
        ? audience.trim().length > 0
        : quizStep === 2
          ? valueDrivers.length > 0
          : true;

  const toggleValueDriver = (value: string) =>
    setValueDrivers((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value].slice(0, 2),
    );

  const generateDraft = async () => {
    const nextGenerationTick = generationTick + 1;
    setGenerationTick(nextGenerationTick);

    const localDraft = buildDraftFromState(nextGenerationTick);
    setGeneratedDraft(localDraft);
    setHasGenerated(true);
    setPreviewTab("product");
    setPreviewSource("local");
    setIsGenerating(true);

    try {
      const response = await request({
        method: "POST",
        url: "/internal/ai_product_page_drafts",
        accept: "json",
        data: {
          product: {
            name: product.name,
            description: stripHtml(product.description),
            rich_content_section_titles: currentContentSections,
            receipt_button_text: product.custom_view_content_button_text ?? "",
            receipt_custom_message: product.custom_receipt_text ?? "",
          },
          quiz: {
            business_summary: businessSummary,
            audience,
            value_drivers: valueDrivers,
            pricing_shape: pricingShape,
            tone,
            delivery_notes: deliveryNotes,
            generation_tick: generationTick,
          },
        },
      });

      const result = await response.json();
      if (isBuildWithAIApiResponse(result) && result.success) {
        setGeneratedDraft(result.data);
        setPreviewSource("api");
      }
    } catch {
      // Keep the local fallback preview when the API is unavailable.
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Button
        className="border-black bg-pink text-black hover:bg-pink/90 hover:text-black"
        onClick={() => {
          setHasGenerated(false);
          setGeneratedDraft(null);
          setPreviewSource(null);
          setOpen(true);
        }}
      >
        <Sparkle className="size-4" />
        Build with AI
      </Button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setHasGenerated(false);
          setGeneratedDraft(null);
          setPreviewSource(null);
          setIsGenerating(false);
          setQuizStep(0);
        }}
        width="min(800px, 96vw)"
        title="Build with AI"
        footer={
          <Button outline onClick={() => setOpen(false)}>
            Cancel
          </Button>
        }
      >
        <div className="grid gap-6">
          <div className="grid min-w-0 gap-4">
            {quizStep === 0 ? (
              <Alert role="status" variant="info">
                Answer a few prompts, and we'll generate a polished output
              </Alert>
            ) : null}

            <SectionCard title={currentStep.title} eyebrow={currentStep.eyebrow}>
              <div className="grid w-full min-w-0 gap-4">
                <div className="text-sm text-muted">{currentStep.description}</div>

                {quizStep === 0 ? (
                  <Fieldset className="w-full min-w-0">
                    <FieldsetTitle>
                      <Label htmlFor={`${uid}-business`}>What are you selling?</Label>
                    </FieldsetTitle>
                    <Textarea
                      id={`${uid}-business`}
                      value={businessSummary}
                      placeholder="A coaching package for first-time founders"
                      onChange={(evt) => setBusinessSummary(evt.target.value)}
                      className="min-h-32 w-full max-w-full min-w-0 self-stretch"
                    />
                    <FieldsetDescription>Required</FieldsetDescription>
                  </Fieldset>
                ) : null}

                {quizStep === 1 ? (
                  <Fieldset>
                    <FieldsetTitle>
                      <Label htmlFor={`${uid}-audience`}>Who is it for?</Label>
                    </FieldsetTitle>
                    <Input
                      id={`${uid}-audience`}
                      value={audience}
                      placeholder="Busy creators, designers, educators"
                      onChange={(evt) => setAudience(evt.target.value)}
                      className="w-full"
                    />
                    <FieldsetDescription>Required</FieldsetDescription>
                  </Fieldset>
                ) : null}

                {quizStep === 2 ? (
                  <Fieldset>
                    <FieldsetTitle>What should buyers care about most?</FieldsetTitle>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {valueDriverOptions.map((option) => (
                        <Button
                          key={option}
                          type="button"
                          outline={!valueDrivers.includes(option)}
                          color={valueDrivers.includes(option) ? "primary" : undefined}
                          className="w-full"
                          onClick={() => toggleValueDriver(option)}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                    <FieldsetDescription>Pick up to two</FieldsetDescription>
                  </Fieldset>
                ) : null}

                {quizStep === 3 ? (
                  <>
                    <Fieldset>
                      <FieldsetTitle>Pricing shape</FieldsetTitle>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {pricingOptions.map((option) => (
                          <Button
                            key={option}
                            type="button"
                            outline={pricingShape !== option}
                            color={pricingShape === option ? "primary" : undefined}
                            onClick={() => setPricingShape(option)}
                          >
                            {option}
                          </Button>
                        ))}
                      </div>
                      <FieldsetDescription>Optional</FieldsetDescription>
                    </Fieldset>
                    <Fieldset>
                      <FieldsetTitle>
                        <Label htmlFor={`${uid}-tone`}>Tone</Label>
                      </FieldsetTitle>
                      <Input
                        id={`${uid}-tone`}
                        value={tone}
                        placeholder="Premium, direct, calm, playful"
                        onChange={(evt) => setTone(evt.target.value)}
                        className="w-full"
                      />
                    </Fieldset>
                    <Fieldset>
                      <FieldsetTitle>
                        <Label htmlFor={`${uid}-delivery`}>Anything else buyers should know?</Label>
                      </FieldsetTitle>
                      <Textarea
                        id={`${uid}-delivery`}
                        value={deliveryNotes}
                        placeholder="What they get, how delivery works, or what outcome to emphasize"
                        onChange={(evt) => setDeliveryNotes(evt.target.value)}
                        className="min-h-24 w-full"
                      />
                    </Fieldset>
                  </>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    outline
                    disabled={quizStep === 0}
                    onClick={() => setQuizStep((step) => Math.max(step - 1, 0))}
                  >
                    Back
                  </Button>
                  {quizStep < intakeSteps.length - 1 ? (
                    <Button
                      className="border-black bg-pink text-black hover:bg-pink/90 hover:text-black"
                      disabled={!canContinue}
                      onClick={() => setQuizStep((step) => Math.min(step + 1, intakeSteps.length - 1))}
                    >
                      Continue
                    </Button>
                  ) : (
                    <Button
                      className="border-black bg-pink text-black hover:bg-pink/90 hover:text-black"
                      disabled={isGenerating}
                      onClick={() => {
                        void generateDraft();
                      }}
                    >
                      {isGenerating ? "Generating..." : "Generate draft"}
                    </Button>
                  )}
                </div>
              </div>
            </SectionCard>
          </div>

          {hasGenerated ? (
            <div className="grid min-w-0 gap-3 rounded border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-bold">Draft preview</div>
                {previewSource === "local" ? (
                  <div className="text-xs tracking-wide text-muted uppercase">local preview</div>
                ) : null}
              </div>
              <Tabs variant="buttons" className="grid min-w-0 grid-cols-3 gap-2">
                <Tab asChild isSelected={previewTab === "product"}>
                  <button type="button" onClick={() => setPreviewTab("product")}>
                    Product
                  </button>
                </Tab>
                <Tab asChild isSelected={previewTab === "content"}>
                  <button type="button" onClick={() => setPreviewTab("content")}>
                    Content
                  </button>
                </Tab>
                <Tab asChild isSelected={previewTab === "receipt"}>
                  <button type="button" onClick={() => setPreviewTab("receipt")}>
                    Receipt
                  </button>
                </Tab>
              </Tabs>
              <div className="text-xs text-muted">These tabs are just for review</div>

              {previewTab === "product" ? (
                <SectionCard title="Product page" eyebrow="Generated">
                  <div className="grid min-w-0 gap-3">
                    <div className="grid gap-1">
                      <div className="text-xs font-medium tracking-wide text-muted uppercase">Title</div>
                      <div className="text-2xl leading-tight font-semibold">{draft.product.title}</div>
                    </div>
                    <div className="grid gap-1">
                      <div className="text-xs font-medium tracking-wide text-muted uppercase">Description</div>
                      {isCoffee ? (
                        <pre className="text-base leading-relaxed whitespace-pre-wrap">{draft.product.description}</pre>
                      ) : (
                        <div
                          className="rich-text text-base leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: draft.product.description }}
                        />
                      )}
                    </div>
                    <div className="grid gap-1">
                      <div className="text-xs font-medium tracking-wide text-muted uppercase">Key benefits</div>
                      <ul className="list-disc space-y-1 pl-5 text-sm">
                        {draft.product.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="grid gap-1">
                      <div className="text-xs font-medium tracking-wide text-muted uppercase">Price suggestion</div>
                      <div className="text-sm">{draft.product.priceSuggestion}</div>
                    </div>
                  </div>
                </SectionCard>
              ) : null}

              {previewTab === "content" ? (
                <SectionCard title="Content page" eyebrow="Generated">
                  <div className="grid min-w-0 gap-3">
                    <div className="text-sm leading-snug">{draft.content.outline}</div>
                    <div className="grid gap-1">
                      <div className="text-xs font-medium tracking-wide text-muted uppercase">Suggested sections</div>
                      <ul className="list-disc space-y-1 pl-5 text-sm">
                        {draft.content.sectionIdeas.map((section) => (
                          <li key={section}>{section}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="grid gap-1">
                      <div className="text-xs font-medium tracking-wide text-muted uppercase">
                        What is already there
                      </div>
                      <div className="text-sm text-muted">{joinWithCommas(draft.content.existingSections)}</div>
                    </div>
                    <div className="grid gap-1">
                      <div className="text-xs font-medium tracking-wide text-muted uppercase">Pages to add</div>
                      <ul className="list-disc space-y-1 pl-5 text-sm">
                        {draft.content.pages.map((page) => (
                          <li key={page.id}>{page.title}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </SectionCard>
              ) : null}

              {previewTab === "receipt" ? (
                <SectionCard title="Receipt page" eyebrow="Generated">
                  <div className="grid min-w-0 gap-3">
                    <div className="grid gap-1">
                      <div className="text-xs font-medium tracking-wide text-muted uppercase">Button text</div>
                      <div className="text-sm">{draft.receipt.buttonText}</div>
                    </div>
                    <div className="grid gap-1">
                      <div className="text-xs font-medium tracking-wide text-muted uppercase">Custom message</div>
                      <div className="text-sm leading-snug">{draft.receipt.customMessage}</div>
                    </div>
                  </div>
                </SectionCard>
              ) : null}

              <details className="rounded border border-border bg-background">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold">
                  Why this works <span className="text-muted">▾</span>
                </summary>
                <div className="border-t border-border p-4">
                  <div className="text-sm leading-snug">{draft.rationale}</div>
                </div>
              </details>

              <div className="flex flex-wrap items-center gap-2">
                <Button outline disabled={isGenerating} onClick={() => void generateDraft()}>
                  {isGenerating ? "Generating..." : "Regenerate"}
                </Button>
                <Button
                  className="border-black bg-pink text-black hover:bg-pink/90 hover:text-black"
                  onClick={() => {
                    onApply(draft);
                    setOpen(false);
                    setHasGenerated(false);
                  }}
                >
                  Apply to product
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
};
