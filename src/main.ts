import "./styles.css";
import { readFiles } from "./fileReaders";
import {
  formatHitMultiplier,
  formatReplacementTotals,
} from "./replacementStats";
import {
  FieldNote,
  parseFieldNoteMdx,
  renderFieldNoteArticle,
} from "./fieldNotes";
import templateFieldNoteSource from "./field-notes/template.mdx?raw";
import { redactDocuments } from "./redactor/engine";
import {
  CandidateKind,
  RedactionLevel,
  ReplacementEntry,
  ReviewModel,
} from "./redactor/types";
import { ENGINE_VERSION, ENGINE_VERSION_DATE } from "./redactor/version";
import projectCatalog from "./data/public-project-catalog.json";
import packageMeta from "../package.json";

/* ------------------------------------------------------------------ *
 * NoAI review workspace (frontend track)
 *
 * The UI only manages files, user edits, and interactions. All
 * deterministic detection, matching, and export text come from the
 * logic layer via `redactDocuments(inputs, { level, entries })`.
 *
 * No AI calls, no backend uploads, no telemetry, no persistent storage
 * of document contents. Source text lives in memory for the session.
 * ------------------------------------------------------------------ */

/* ----------------------------- State ------------------------------ */

interface LoadedDocument {
  id: string;
  fileName: string;
  text: string;
  warnings: string[];
}

type AppRoute =
  | "workspace"
  | "field-notes"
  | "field-note-template"
  | "faq"
  | "about"
  | "privacy"
  | "terms"
  | "changelog";
type InfoRoute = Exclude<AppRoute, "workspace">;

interface AppState {
  route: AppRoute;
  infoMenuOpen: boolean;
  documents: LoadedDocument[];
  selectedDocumentId: string | null;
  /** User-controlled entries. Re-passed to the engine on every rebuild so
   *  edits and manual terms survive re-detection. */
  entries: ReplacementEntry[];
  /** Entry ids deleted by the user, so automatic detections stay out. */
  removedEntryIds: Set<string>;
  level: RedactionLevel;
  review: ReviewModel | null;
  query: string;
  previewQuery: string;
  expandedKinds: Set<string>;
  documentsCollapsed: boolean;
  redactionsCollapsed: boolean;
  busy: boolean;
  /** Entry id currently shown in the preview popover. */
  selectedEntryId: string | null;
  showOriginalPreview: boolean;
  showPreviewSearch: boolean;
  changelogExpanded: boolean;
  devModeActive: boolean;
}

const APP_VERSION = packageMeta.version;

const state: AppState = {
  route: routeFromHash(),
  infoMenuOpen: false,
  documents: [],
  selectedDocumentId: null,
  entries: [],
  removedEntryIds: new Set(),
  level: "balanced",
  review: null,
  query: "",
  previewQuery: "",
  expandedKinds: new Set(),
  documentsCollapsed: false,
  redactionsCollapsed: false,
  busy: false,
  selectedEntryId: null,
  showOriginalPreview: false,
  showPreviewSearch: false,
  changelogExpanded: false,
  devModeActive: false,
};

type InfoBlock =
  | { type: "text"; text: string }
  | { type: "html"; html: string }
  | { type: "qa"; question: string; answer: string[] }
  | { type: "qa-html"; question: string; answerHtml: string[] }
  | { type: "qa-rich"; question: string; bodyHtml: string };

interface InfoSection {
  heading: string;
  blocks: InfoBlock[];
}

interface InfoPageScaffold {
  route: InfoRoute;
  title: string;
  summary: string;
  sections: InfoSection[];
}

type CatalogLocale = "zh-Hans" | "zh-Hant" | "en" | "ko" | "ja";

interface PublicProject {
  id: string;
  name: Record<CatalogLocale, string>;
  tagline: Record<CatalogLocale, string>;
  platforms: string[];
  links: Partial<Record<"website" | "appStore" | "download" | "github", string>>;
  icon: {
    light: string;
    dark?: string;
    alt: Record<CatalogLocale, string>;
  };
  showInApps: boolean;
  order: number;
}

const CURRENT_PROJECT_ID = "noai";
const PUBLIC_PROJECTS = projectCatalog as PublicProject[];

const FIELD_NOTES: FieldNote[] = [parseFieldNoteMdx(templateFieldNoteSource)];
const FIELD_NOTE_TEMPLATE = FIELD_NOTES[0];

const INFO_PAGE_SCAFFOLDS: Record<InfoRoute, InfoPageScaffold> = {
  "field-notes": {
    route: "field-notes",
    title: "Field Notes",
    summary:
      "Irregular notes from building NoAI: privacy boundaries, redaction engine changes, document workflows, and small decisions worth leaving a trail for.",
    sections: [
      {
        heading: "Notes",
        blocks: [
          {
            type: "html",
            html: renderFieldNotesGrid(),
          },
        ],
      },
    ],
  },
  "field-note-template": {
    route: "field-note-template",
    title: FIELD_NOTE_TEMPLATE.title,
    summary: FIELD_NOTE_TEMPLATE.summary,
    sections: [],
  },
  faq: {
    route: "faq",
    title: "FAQ",
    summary:
      "Frequently asked questions about how NoAI works, what it can and cannot do, and how to use its output. Plain answers, no fine print.",
    sections: [
      {
        heading: "How NoAI works",
        blocks: [
          {
            type: "qa-rich",
            question: "Does NoAI send my documents anywhere?",
            bodyHtml: `
              <p>No. NoAI is a static web app: the app downloads to your browser, then your browser runs it on your device. When you add a document, NoAI's rule-based scripts read and redact it locally. The redaction process does not upload any document content to any server or call any AI model.</p>
              <p>That is different from sending a document to, say, ChatGPT. In that flow, the document goes to OpenAI's servers, gets processed there, and then a response comes back to you.</p>
              <div class="privacy-flow-comparison" aria-label="Comparison of where document processing happens">
                <div class="privacy-model privacy-model-remote">
                  <div class="privacy-model-head">
                    <i class="ph ph-chat-circle-text" aria-hidden="true"></i>
                    <span>When an AI server is involved</span>
                  </div>
                  <div class="privacy-tier-map">
                    <div class="privacy-tier privacy-tier-server">
                      <span class="privacy-tier-node">
                        <i class="ph ph-cloud" aria-hidden="true"></i>
                        <span>AI server</span>
                      </span>
                    </div>
                    <div class="privacy-action-band privacy-action-band-remote">
                      <span class="privacy-action privacy-action-upload">
                        <i class="ph ph-arrow-up" aria-hidden="true"></i>
                        <span>Upload document</span>
                      </span>
                      <span class="privacy-action privacy-action-return">
                        <i class="ph ph-arrow-down" aria-hidden="true"></i>
                        <span>Response returns</span>
                      </span>
                    </div>
                    <div class="privacy-tier privacy-tier-browser">
                      <span class="privacy-tier-node">AI chat page</span>
                    </div>
                    <div class="privacy-action-band privacy-action-band-user">
                      <span class="privacy-action privacy-action-upload">
                        <i class="ph ph-arrow-up" aria-hidden="true"></i>
                        <span>Send document</span>
                      </span>
                      <span class="privacy-action privacy-action-return">
                        <i class="ph ph-arrow-down" aria-hidden="true"></i>
                        <span>Get response</span>
                      </span>
                    </div>
                    <div class="privacy-tier privacy-tier-you">
                      <span class="privacy-tier-node">You</span>
                    </div>
                  </div>
                  <p>Documents are processed on the server, so an upload is involved.</p>
                </div>
                <div class="privacy-model privacy-model-local">
                  <div class="privacy-model-head">
                    <i class="ph ph-shield-check" aria-hidden="true"></i>
                    <span>How NoAI works</span>
                  </div>
                  <div class="privacy-tier-map">
                    <div class="privacy-tier privacy-tier-server">
                      <span class="privacy-tier-node">
                        <i class="ph ph-cloud" aria-hidden="true"></i>
                        <span>NoAI static site</span>
                      </span>
                    </div>
                    <div class="privacy-action-band privacy-action-band-download">
                      <span class="privacy-action privacy-action-download">
                        <i class="ph ph-arrow-down" aria-hidden="true"></i>
                        <span>Download web app</span>
                      </span>
                    </div>
                    <div class="privacy-tier privacy-tier-browser privacy-tier-browser-local">
                      <span class="privacy-tier-node">Browser</span>
                    </div>
                    <div class="privacy-action-band privacy-action-band-local">
                      <span class="privacy-action">
                        <i class="ph ph-arrow-up" aria-hidden="true"></i>
                        <span>Open document</span>
                      </span>
                      <span class="privacy-action privacy-action-local-return">
                        <i class="ph ph-arrow-down" aria-hidden="true"></i>
                        <span>Get redacted Markdown</span>
                      </span>
                    </div>
                    <div class="privacy-tier privacy-tier-you">
                      <span class="privacy-tier-node">You</span>
                    </div>
                  </div>
                  <p>The app downloads to your browser. Documents are processed on your device, so no upload is involved.</p>
                </div>
              </div>
            `,
          },
          {
            type: "qa",
            question: "Does NoAI use AI to find sensitive text?",
            answer: [
              "No. Detection uses fixed, rule-based patterns, like a checklist applied the same way every time. It is deterministic and inspectable: each item NoAI finds is listed so you can keep, change, or remove it before exporting.",
            ],
          },
          {
            type: "qa",
            question: 'What does "local and mechanical" mean?',
            answer: [
              "The same input always produces the same redactions on the same settings. There is no learning, no model, and no remote processing of your text.",
              "For example, a phone number is redacted because it matches a fixed pattern, not because NoAI learned what a phone number is. Run the same document twice and you get the same result both times.",
            ],
          },
          {
            type: "qa-html",
            question: "Does NoAI learn from my documents?",
            answerHtml: [
              "No. NoAI has no access to your documents.",
              'However, the developer does update the engine from time to time by testing them against publicly available business and legal documents. See our <a href="#/changelog">changelog</a>.',
            ],
          },
          {
            type: "qa-html",
            question: "How do I know what you say is true?",
            answerHtml: [
              "NoAI is open-source software, and its full source code is available on <a href=\"https://github.com/galza-guo/NoAI\" target=\"_blank\" rel=\"noopener\">GitHub</a>. You can review the code yourself, or ask your AI assistant to verify it using a prompt like this:",
              `<div class="sample-prompt-container">
                <div class="sample-prompt-header">
                  <span class="sample-prompt-title">Sample Prompt</span>
                  <button type="button" class="copy-prompt-btn" data-copy-text="Here is the source code for NoAI: https://github.com/galza-guo/NoAI. Please review the redaction engine and confirm whether it uploads my documents to any external server or uses an AI model." aria-label="Copy prompt" title="Copy prompt">
                    <i class="ph ph-copy" aria-hidden="true"></i>
                  </button>
                </div>
                <div class="sample-prompt-body">
                  <pre><code id="verification-prompt-code">Here is the source code for NoAI: https://github.com/galza-guo/NoAI. Please review the redaction engine and confirm whether it uploads my documents to any external server or uses an AI model.</code></pre>
                </div>
              </div>`,
            ],
          },
        ],
      },
      {
        heading: "Files and exports",
        blocks: [
          {
            type: "qa",
            question: "Which file types can I use?",
            answer: [
              "Markdown (.md), plain text (.txt), Word documents (.docx), and text-based PDFs.",
            ],
          },
          {
            type: "qa",
            question: "Can I redact scanned PDFs or images?",
            answer: [
              "Not reliably. Convert or paste the text in first.",
            ],
          },
          {
            type: "qa",
            question: "What can I export?",
            answer: [
              "A redacted Markdown file for each document, or a combined Markdown file when you process several at once.",
            ],
          },
          {
            type: "qa",
            question: "What is Markdown and why?",
            answer: [
              "Markdown is a lightweight plain-text formatting syntax. It is the 'native' format for most AI agents and LLMs, making it the most reliable way to feed structured text into them.",
            ],
          },
        ],
      },
      {
        heading: "Redaction levels",
        blocks: [
          {
            type: "qa",
            question: "What are Light, Balanced, and Heavy?",
            answer: [
              "They set how aggressively NoAI redacts text. Each level includes everything in the previous level:",
              "• Light: Direct identifiers including Email, Phone, URL, Address, Postcode, National ID, Business ID, Bank IBAN, and Case References.",
              "• Balanced (default): Adds contextual identifiers including Person Names, Organizations, Dates, Amounts, Locations, and Exhibit, Bundle, Transcript, and Procedural References.",
              "• Heavy: Adds Proper Nouns (general capitalized phrases, project names, and brands).",
            ],
          },
          {
            type: "qa",
            question: "Do my custom terms still apply at every level?",
            answer: [
              "Yes. Anything you add as a custom term is redacted consistently at Light, Balanced, and Heavy.",
            ],
          },
        ],
      },
      {
        heading: "Accuracy and review limits",
        blocks: [
          {
            type: "qa",
            question: "Does NoAI catch everything?",
            answer: [
              "No. It reliably finds common patterns such as emails, phone numbers, dates, amounts, and reference numbers, but it can miss things or redact more than you would like. Treat the result as a strong first pass, not a guarantee.",
            ],
          },
          {
            type: "qa",
            question: "Do I need to check the result?",
            answer: [
              "Yes. Always review the redacted output before you share it or paste it into another tool. You can keep, change, or remove any redaction before exporting.",
            ],
          },
        ],
      },
      {
        heading: "Using the output with external AI tools",
        blocks: [
          {
            type: "qa",
            question: "Why Markdown?",
            answer: [
              "It is widely supported by AI tools and chatbots and pastes in cleanly, so your redacted document is easy to reuse.",
            ],
          },
          {
            type: "qa",
            question: "What should I do before pasting into another AI tool?",
            answer: [
              "Review the redacted output first, then copy only what you are comfortable sharing. NoAI does not control or see what you do in other tools.",
            ],
          },
          {
            type: "qa",
            question: "Does NoAI connect to those tools for me?",
            answer: [
              "No. NoAI only prepares the text. Any sharing is something you do yourself, after reviewing.",
            ],
          },
        ],
      },
    ],
  },
  about: {
    route: "about",
    title: "About",
    summary:
      "Local-only redaction tool built for AI age.",
    sections: [
      {
        heading: "What NoAI is",
        blocks: [
          {
            type: "text",
            text: "A local tool for preparing documents before using AI.",
          },
          {
            type: "text",
            text: "No AI calls. No document uploads. No backend conversion.",
          },
          {
            type: "text",
            text: "Review the output before sharing.",
          },
        ],
      },
      {
        heading: "Contact",
        blocks: [
          {
            type: "html",
            html: '<p>Gallant GUO<br><a href="mailto:glt@gallantguo.com">glt@gallantguo.com</a></p>',
          },
        ],
      },
      {
        heading: "More by Me",
        blocks: [
          {
            type: "html",
            html: renderMoreByMeProjects(),
          },
        ],
      },
      {
        heading: "Source",
        blocks: [
          {
            type: "html",
            html: `
              <div class="info-link-list">
                <a href="https://github.com/galza-guo/NoAI" target="_blank" rel="noopener">
                  <i class="ph ph-github-logo" aria-hidden="true"></i>
                  <span>Open source · GitHub</span>
                </a>
                <a href="https://github.com/galza-guo/NoAI/blob/main/LICENSE" target="_blank" rel="noopener">
                  <i class="ph ph-scroll" aria-hidden="true"></i>
                  <span>AGPL v3.0 · License</span>
                </a>
              </div>
            `,
          },
        ],
      },
    ],
  },
  privacy: {
    route: "privacy",
    title: "Privacy Policy",
    summary:
      "How NoAI handles information. Short version: document text is processed in your browser, not uploaded to NoAI, and not sent to an AI model by NoAI.",
    sections: [
      {
        heading: "Information NoAI processes",
        blocks: [
          {
            type: "text",
            text: "NoAI reads the files you choose to add to the app, such as Markdown, plain text, Word documents, and text-based PDFs. It uses that text to find likely sensitive items and produce redacted Markdown.",
          },
          {
            type: "text",
            text: "The document text is handled in your browser session. NoAI does not intentionally collect, store, or upload the contents of your documents.",
          },
          {
            type: "text",
            text: "NoAI does not currently have user accounts, sign-in, subscriptions, or a payment flow in this app. Because there is no account system, NoAI does not ask for names, passwords, billing details, or profile information before you use the redaction workspace.",
          },
          {
            type: "text",
            text: "NoAI does not include analytics, telemetry, crash reporting, advertising pixels, or product-tracking scripts that inspect document contents.",
          },
        ],
      },
      {
        heading: "Local browser processing",
        blocks: [
          {
            type: "text",
            text: "Redaction happens locally in your browser. The website loads the app code, then your browser reads the selected files and applies deterministic redaction rules on your device.",
          },
          {
            type: "text",
            text: "NoAI does not send your document text to a backend server, conversion service, or AI model as part of the redaction process. NoAI's redaction path is rule-based: it uses fixed patterns and deterministic checks, not an AI model.",
          },
          {
            type: "text",
            text: "The export is generated in your browser from the redacted text. Downloading or copying the output does not upload the original document to NoAI.",
          },
          {
            type: "text",
            text: "After export, you control where the Markdown goes. If you paste it into an external AI tool, that separate tool's privacy policy and terms apply.",
          },
        ],
      },
      {
        heading: "Network requests and third parties",
        blocks: [
          {
            type: "text",
            text: "Your browser has to request the NoAI website files from the site host, such as HTML, JavaScript, styles, icons, and the logo. The current app may also request web fonts from Google Fonts, depending on how the site is deployed.",
          },
          {
            type: "text",
            text: "Those requests are for loading the app interface. They are not document uploads by NoAI. NoAI's redaction code does not intentionally send document text to third parties.",
          },
          {
            type: "text",
            text: "NoAI does not send files to a remote OCR or conversion provider. Text-based PDFs can be read in the browser. Scanned-image PDFs may not contain readable text, so NoAI may not be able to redact them unless you convert them to text before using NoAI.",
          },
          {
            type: "text",
            text: "Be careful with what you do after export. If you upload the original file or paste redacted Markdown into another service, that action is outside NoAI and is governed by that service's rules.",
          },
        ],
      },
      {
        heading: "Storage and retention",
        blocks: [
          {
            type: "text",
            text: "NoAI does not intentionally save your document contents to its servers. During a browser session, your selected document text is kept in memory so the workspace can preview, edit, and export redactions.",
          },
          {
            type: "text",
            text: "If you refresh or close the page, the session state is normally cleared by the browser. NoAI may store small interface preferences in your browser, such as whether you have already seen the first-use notice. These preferences are not document contents.",
          },
          {
            type: "text",
            text: "NoAI can remove a document from the current workspace view, but it cannot delete the original file from your computer. If you download redacted Markdown, that downloaded file is stored wherever your browser saves downloads.",
          },
          {
            type: "text",
            text: "Your browser, operating system, or downloaded files folder may keep copies of files you choose to save. Manage those copies through your own device and browser settings.",
          },
        ],
      },
      {
        heading: "User choices and contact",
        blocks: [
          {
            type: "text",
            text: "Use NoAI on a device and browser you trust. Review the redacted preview and the redaction list before exporting. Search the output for names, emails, phone numbers, case numbers, and any terms you know are sensitive.",
          },
          {
            type: "text",
            text: "For high-risk documents, treat NoAI as a first pass. Have a human review the final output before sharing it with an AI tool or anyone else.",
          },
          {
            type: "html",
            html: '<p>Use the contact details on the <a href="#/about">About</a> page once they are added. Please do not send private client, legal, personal, or proprietary documents when reporting a bug. Use a synthetic example that shows the pattern without exposing real information.</p>',
          },
        ],
      },
    ],
  },
  terms: {
    route: "terms",
    title: "User Agreement",
    summary:
      "The ground rules for using NoAI. NoAI is a practical redaction helper, not a guarantee, and you remain responsible for reviewing what you share.",
    sections: [
      {
        heading: "Using NoAI",
        blocks: [
          {
            type: "text",
            text: "NoAI helps you prepare documents before using external AI tools. It reads supported files in your browser, applies deterministic redaction rules, and exports redacted Markdown.",
          },
          {
            type: "text",
            text: "It is designed for practical review workflows, especially for people and small teams who want a local first-pass privacy check before pasting material into another tool.",
          },
          {
            type: "html",
            html: '<p>NoAI handles information as described in the <a href="#/privacy">Privacy Policy</a>. Read it together with this User Agreement before using the app.</p>',
          },
          {
            type: "text",
            text: "By using NoAI, you agree to use it responsibly and to review the output before sharing it. You also agree not to use NoAI to break the law, violate someone else's rights, or create a false impression that a document has been fully anonymized or legally redacted when it has not been reviewed.",
          },
          {
            type: "text",
            text: "NoAI may update these terms as the app changes. The current version shown in the app is the version that applies when you use it.",
          },
        ],
      },
      {
        heading: "User responsibility",
        blocks: [
          {
            type: "text",
            text: "You are responsible for the final document. NoAI can help find and replace likely sensitive text, but it cannot know every fact, relationship, code name, unusual identifier, or context-specific detail that matters in your document.",
          },
          {
            type: "text",
            text: "Before sharing anything, review the redacted Markdown yourself. For important or high-risk material, ask a qualified human reviewer to check it too.",
          },
          {
            type: "text",
            text: "Check for visible names, email addresses, phone numbers, URLs, addresses, account numbers, case references, project names, client names, and other details that would identify a person, company, matter, or transaction. Also check context: a document can reveal sensitive information even after obvious identifiers are removed.",
          },
          {
            type: "text",
            text: "Once you paste or upload anything to another service, that service's privacy policy, terms, retention settings, and account controls apply. NoAI cannot control what external AI tools do with text you choose to send them.",
          },
        ],
      },
      {
        heading: "No legal or professional advice",
        blocks: [
          {
            type: "text",
            text: "NoAI is software, not a lawyer, compliance advisor, privacy officer, or professional reviewer.",
          },
          {
            type: "text",
            text: "NoAI does not tell you whether a document is safe to disclose, whether a redaction is legally sufficient, or whether using an external AI tool is allowed for your situation.",
          },
          {
            type: "text",
            text: "Get professional advice before using NoAI as part of a legal production, regulatory response, client disclosure, employment matter, medical or financial workflow, or any situation where disclosure could harm someone or breach a duty.",
          },
          {
            type: "text",
            text: "NoAI can support preparation, but it should not be the only safeguard for high-risk documents.",
          },
        ],
      },
      {
        heading: "No perfect-redaction guarantee",
        blocks: [
          {
            type: "text",
            text: "NoAI does not guarantee perfect redaction, anonymization, de-identification, or confidentiality.",
          },
          {
            type: "text",
            text: "The redaction engine is deterministic and rule-based. That makes it inspectable, but it can still miss unusual names, rare formats, implied identifiers, handwritten or scanned text, and sensitive context that only a person would understand.",
          },
          {
            type: "text",
            text: "NoAI may also redact text that is not actually sensitive, especially in the Heavy review setting. Use the review list to adjust replacements, remove incorrect redactions, and add custom terms that matter for your document.",
          },
          {
            type: "text",
            text: "Treat NoAI output as a draft for review. Do not publish, disclose, or send documents solely because NoAI produced a redacted version.",
          },
        ],
      },
      {
        heading: "License, warranty, and liability",
        blocks: [
          {
            type: "html",
            html: '<p>NoAI is open-source software licensed under the GNU Affero General Public License v3.0 only. You can inspect the source code on <a href="https://github.com/galza-guo/NoAI" target="_blank" rel="noopener">GitHub</a>.</p>',
          },
          {
            type: "text",
            text: "If you modify NoAI and offer the modified version to users over a network, the AGPL may require you to make your modified source code available under the same license.",
          },
          {
            type: "text",
            text: "NoAI is provided as-is, without a promise that it will be error-free, fit for a particular purpose, or sufficient for your specific legal, business, compliance, or privacy needs.",
          },
          {
            type: "text",
            text: "To the extent allowed by applicable law, the maintainers are not responsible for losses that result from your use of NoAI, your review decisions, or your sharing of documents with third-party services.",
          },
          {
            type: "text",
            text: "Nothing in these terms is intended to remove rights or protections that cannot legally be waived. If any part of these terms is not enforceable, the rest should still apply as far as the law allows.",
          },
        ],
      },
    ],
  },
  changelog: {
    route: "changelog",
    title: "Version History",
    summary:
      "A plain-English record of NoAI app and redaction engine changes. Engine updates improve deterministic detection, but NoAI is still a first-pass tool: review the output before sharing it.",
    sections: [
      {
        heading: "Engine changelog",
        blocks: [
          {
            type: "qa",
            question: "1.0.10 - additional release-candidate repairs",
            answer: [
              "Tightened person and organization detection so labels and neighboring text are less likely to be swept into the same redaction.",
              "Improved handling for multi-line legal correspondence fields.",
              "Added regression tests for the repaired edge cases.",
            ],
          },
          {
            type: "qa",
            question: "1.0.9 - regulatory notice repair",
            answer: [
              "Improved detection when labels such as To: or Firm Name: are on one line and the person or organization appears on the next line.",
              "Kept generic salutations, such as Whom It May Concern, readable.",
            ],
          },
          {
            type: "qa",
            question: "1.0.8 - regulatory and compliance documents",
            answer: [
              "Added coverage for common regulator matter numbers, docket numbers, complaint numbers, charge numbers, agency case codes, registration identifiers, and regulator letter signature blocks.",
              "Reduced false positives around government agency names, statute references, notice headings, and common order language.",
              "This pass was tested with synthetic examples modeled on regulatory enforcement and compliance notices.",
            ],
          },
          {
            type: "qa",
            question: "1.0.7 - procurement repair",
            answer: [
              "Added detection for compound procurement and payment references, such as a labeled payment reference number.",
              "Treated Buyer Name and Bidder Name fields as person-or-organization labels, since those fields can contain either a contact or an entity.",
            ],
          },
          {
            type: "qa",
            question: "1.0.6 - procurement, RFP, and purchase order documents",
            answer: [
              "Added coverage for solicitation numbers, RFP/RFQ/RFI/IFB numbers, purchase order numbers, contract numbers, requisition numbers, vendor IDs, invoice numbers, bid numbers, tender numbers, and quote numbers when they are clearly labeled.",
              "Added contact-field detection for procurement officers, procurement contacts, buyers, and bidders.",
              "Reduced false positives around procurement boilerplate such as Scope of Work, Terms and Conditions, Vendor, Contractor, and Purchase Order when those phrases are not acting as identifiers.",
            ],
          },
          {
            type: "qa",
            question: "1.0.5 - securities identifier repair",
            answer: [
              "Added checksum validation for ISIN detection so real securities identifiers are covered without redacting arbitrary 12-character codes that only look similar.",
            ],
          },
          {
            type: "qa",
            question: "1.0.4 - listed-company and stock-exchange documents",
            answer: [
              "Added coverage for exchange stock codes, ISINs, SEDOLs, LEIs, Australian ABNs, ACNs, ARBNs, and common filing-officer fields.",
              "Reduced over-redaction around stock exchange names, meeting boilerplate, director role titles, and listing-rule language.",
            ],
          },
          {
            type: "qa",
            question: "1.0.3 - release-candidate repair",
            answer: [
              "Improved detection for local phone numbers, dot-separated business phone numbers, P.O. Box addresses, directional street addresses, Singapore postcodes, and Dutch postcodes in address context.",
              "Reduced false positives around SEC-style file numbers, ZIP+4 values, and some organization-suffix matches.",
            ],
          },
          {
            type: "qa",
            question: "1.0.2 - mixed business and legal documents",
            answer: [
              "Improved handling for operational legal and business documents such as offer letters, acquisition letters, separation agreements, legal opinion letters, and advisory engagement letters.",
              "Reduced false positives around defined terms, departments, date wording, business-number labels, and boilerplate markers.",
            ],
          },
          {
            type: "qa",
            question: "1.0.1 - early coverage expansion",
            answer: [
              "Expanded deterministic coverage for additional legal and business patterns.",
              "Added boundary checks, normalization, replacement consistency improvements, and regression tests.",
            ],
          },
          {
            type: "qa",
            question: "1.0.0 - initial versioned engine baseline",
            answer: [
              "Established the first versioned baseline for common English business and legal documents.",
              "Covered common identifiers such as emails, phone numbers, URLs, addresses, postcodes, IDs, bank details, case and filing references, names, organizations, dates, amounts, locations, project terms, correspondence metadata, litigation captions, contact blocks, and signature blocks.",
              "Known limit: the engine is rule-based and inspectable, so unusual names, rare address formats, and context-only identifiers can still require human review.",
            ],
          },
        ],
      },
    ],
  },
};

const SITE_LINKS: Array<{ route: AppRoute; label: string; icon: string }> = [
  { route: "workspace", label: "NoAI", icon: "ph-file-lock" },
  { route: "field-notes", label: "Field Notes", icon: "ph-notebook" },
  { route: "faq", label: "FAQ", icon: "ph-question" },
  { route: "about", label: "About", icon: "ph-info" },
  { route: "privacy", label: "Privacy", icon: "ph-shield-check" },
  { route: "terms", label: "Terms", icon: "ph-scroll" },
  {
    route: "changelog",
    label: "Version History",
    icon: "ph-clock-counter-clockwise",
  },
];

const SITE_MENU_LINKS = SITE_LINKS.filter((link) => link.route !== "workspace");

let docCounter = 0;
function nextDocId(): string {
  docCounter += 1;
  return `local-${docCounter}`;
}

const LEVEL_DESCRIPTIONS: Record<RedactionLevel, string> = {
  light: "Direct identifiers only; best readability.",
  balanced: "Names, orgs, dates, amounts; default review.",
  heavy: "More aggressive; strongest privacy pass.",
};

import "@phosphor-icons/web/regular";
import "@phosphor-icons/web/fill";

const icon = {
  alert: '<i class="ph ph-warning" aria-hidden="true"></i>',
  chevronLeft:
    '<i class="button-icon ph ph-caret-left" aria-hidden="true"></i>',
  chevronRight:
    '<i class="button-icon ph ph-caret-right" aria-hidden="true"></i>',
  chevronDown: '<i class="ph ph-caret-down" aria-hidden="true"></i>',
  x: '<i class="button-icon ph ph-x" aria-hidden="true"></i>',
  trash: '<i class="button-icon ph ph-trash-simple" aria-hidden="true"></i>',
  sidebar: '<i class="ph ph-sidebar-simple" aria-hidden="true"></i>',
};

/* ----------------------------- Dev mode ---------------------------- */

/**
 * Local development convenience. Gated on Vite's DEV flag so these affordances
 * are dead-code-eliminated from production builds; the runtime path (no uploads,
 * no AI, no telemetry) is unchanged.
 *
 * - Auto-loads a synthetic sample document on boot so the review UI is populated
 *   without dragging a file in each time.
 * - Shows a bottom-left FAB to reload the sample.
 *
 * Disable in `.env` with VITE_DEV_SAMPLE=false.
 */
const DEV_MODE =
  import.meta.env.DEV && import.meta.env.VITE_DEV_SAMPLE !== "false";
const DEV_SAMPLE_PATH: string =
  import.meta.env.VITE_DEV_SAMPLE_PATH || "/dev-sample.md";
const EMBEDDED_DEV_SAMPLE = `From: Morgan Vale
To: Priya Shah
Cc: Northwind Trading Ltd.
Date: 28 November 2025
Re: Project Lighthouse response letter
File No. 001-39940
Registration No. 333-901023
Direct Dial No.: (212) 555-0148
Email: morgan.vale@example.com

Dear Ms. Shah:

The company reviewed Risk Management and Use of Proceeds comments with
Jordan Price and Dana Frost. Please send notices to 221 Baker Street,
Suite 400, London SW1A 1AA.

Sincerely,

/s/ Morgan Vale
Name: Morgan Vale
Title: General Counsel
`;

/* --------------------------- DOM scaffold -------------------------- */

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root was not found.");

app.innerHTML = `
  <main class="app-shell">
    <header class="topbar">
      <a class="brand-link" href="#/" aria-label="NoAI workspace">
        <img src="/logo.png" alt="NoAI Logo" class="brand-logo" />
      </a>
      <div class="site-menu-wrap">
        <button id="site-menu-toggle" type="button" class="icon-button site-menu-toggle" aria-expanded="false" aria-controls="site-menu" aria-label="Open site menu">
          <i class="ph ph-list" aria-hidden="true"></i>
        </button>
      </div>
      <div class="reading-progress" id="reading-progress" aria-hidden="true" hidden></div>
    </header>
    <nav class="site-menu" id="site-menu" aria-label="NoAI pages" aria-hidden="true" inert>
      <button id="site-menu-close" type="button" class="icon-button site-menu-close" aria-label="Close site menu">
        <i class="ph ph-x" aria-hidden="true"></i>
      </button>
      <div class="site-menu-list">
        ${renderSiteMenuLinks()}
      </div>
    </nav>

    <section class="workspace" id="workspace-view">

      <section class="workspace-grid" id="workspace-grid" aria-live="polite">

        <section class="panel files-panel">
          <div class="panel-head">
            <h2>Documents</h2>
            <button id="documents-toggle" type="button" class="icon-button" aria-expanded="true" aria-label="Collapse documents sidebar">${icon.sidebar}</button>
          </div>
          <div class="files-content" id="files-content">
            <div class="files-scroll-area" data-dropzone>
              <div class="files-body" id="files-body"></div>
              <label class="dropzone documents-dropzone dropzone-small" id="documents-dropzone" data-dropzone>
                <input type="file" multiple accept=".md,.markdown,.txt,.docx,.pdf" data-file-input />
                <span class="supported-file-icons" data-empty-only aria-hidden="true">
                  <i class="ph ph-file-md"></i>
                  <i class="ph ph-file-txt"></i>
                  <i class="ph ph-file-doc"></i>
                  <i class="ph ph-file-pdf"></i>
                </span>
                <span class="drop-title" data-documents-drop-title>Add more documents</span>
                <span class="drop-meta" data-empty-only>Drop files here or click to open.</span>
              </label>
            </div>
            <div class="document-controls">
              <fieldset class="level-control" aria-label="Redaction level">
                <legend>Redaction level</legend>
                <div class="level-options">
                  <button type="button" class="level-option" data-level="light" aria-pressed="false">
                    <span class="level-icon" aria-hidden="true">
                      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <text x="20" y="34" class="redaction-a-base" text-anchor="middle">A</text>
                        <polygon class="redaction-strike" points="5,18 38,18 35,23 2,23" />
                      </svg>
                    </span>
                    <span class="level-copy">
                      <span class="level-title">Light</span>
                      <span class="level-desc">Direct identifiers only; best readability.</span>
                    </span>
                  </button>
                  <button type="button" class="level-option" data-level="balanced" aria-pressed="true">
                    <span class="level-icon" aria-hidden="true">
                      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <text x="20" y="34" class="redaction-a-base" text-anchor="middle">A</text>
                        <polygon class="redaction-strike" points="5,10 38,10 35,15 2,15" />
                        <polygon class="redaction-strike" points="5,26 38,26 35,31 2,31" />
                      </svg>
                    </span>
                    <span class="level-copy">
                      <span class="level-title">Balanced</span>
                      <span class="level-desc">Names, orgs, dates, amounts; default review.</span>
                    </span>
                  </button>
                  <button type="button" class="level-option" data-level="heavy" aria-pressed="false">
                    <span class="level-icon" aria-hidden="true">
                      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <text x="20" y="34" class="redaction-a-base" text-anchor="middle">A</text>
                        <polygon class="redaction-strike" points="5,10 38,10 35,15 2,15" />
                        <polygon class="redaction-strike" points="5,18 38,18 35,23 2,23" />
                        <polygon class="redaction-strike" points="5,26 38,26 35,31 2,31" />
                      </svg>
                    </span>
                    <span class="level-copy">
                      <span class="level-title">Heavy</span>
                      <span class="level-desc">More aggressive; strongest privacy pass.</span>
                    </span>
                  </button>
                </div>
                <p class="level-active-desc" id="level-active-desc"></p>
              </fieldset>
              <button id="download-button" type="button" class="download-action" disabled>
                <i class="download-icon ph ph-download-simple" aria-hidden="true"></i>
                <span>Combined Markdown</span>
              </button>
            </div>
          </div>
        </section>

        <section class="panel preview-panel">
          <div class="resizer resizer-left" id="resizer-left" aria-hidden="true"></div>
          <div class="resizer resizer-right" id="resizer-right" aria-hidden="true"></div>
          <div class="panel-head">
            <div class="panel-title-actions">
              <h2 id="preview-title">Preview</h2>
              <button id="preview-visibility-toggle" type="button" class="icon-button preview-visibility-toggle" disabled aria-pressed="false" aria-label="Show original text" title="Show original text">
                <i class="ph ph-eye" aria-hidden="true"></i>
              </button>
            </div>
            <div class="panel-actions">
              <button id="preview-search-toggle" type="button" class="icon-button preview-search-toggle" disabled aria-pressed="false" aria-label="Show preview search" title="Show preview search">
                <i class="ph ph-magnifying-glass" aria-hidden="true"></i>
              </button>
              <button id="copy-doc-button" type="button" class="icon-button" disabled title="Copy redacted text">
                <i class="ph ph-copy" aria-hidden="true"></i>
              </button>
              <button id="download-doc-button" type="button" class="icon-button download-action" disabled title="Download this document">
                <i class="download-icon ph ph-download-simple" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          <div class="preview-search" id="preview-search" hidden>
            <label class="sr-only" for="preview-search-input">Search preview text</label>
            <div class="preview-search-box">
              <i class="ph ph-magnifying-glass" aria-hidden="true"></i>
              <input id="preview-search-input" type="search" placeholder="Search redacted and original text" autocomplete="off" />
              <button id="preview-search-clear" type="button" class="icon-button preview-search-clear" aria-label="Clear preview search" hidden>${icon.x}</button>
            </div>
            <div class="preview-search-summary" id="preview-search-summary"></div>
            <div class="preview-search-results" id="preview-search-results" hidden></div>
          </div>
          <div class="preview-body" id="preview-body"></div>
        </section>

        <section class="panel replacements-panel">
          <div class="panel-head">
            <div class="panel-title-actions">
              <button id="redactions-toggle" type="button" class="icon-button redactions-toggle" aria-expanded="true" aria-label="Collapse redactions sidebar">${icon.sidebar}</button>
              <h2>Redactions</h2>
            </div>
            <span class="panel-count" id="replacements-count"></span>
          </div>
          <div class="replacements-controls">
            <label class="sr-only" for="search-input">Search or add term</label>
            <div class="omnibox-container">
              <input id="search-input" type="text" name="replacement-search" placeholder="Search or Add term ..." autocomplete="off" />
              <span id="omnibox-add-action" class="omnibox-add-action" hidden>Add</span>
            </div>
          </div>
          <div class="replacements-body" id="replacements-body"></div>
        </section>

      </section>
    </section>

    <section class="info-view" id="info-view" hidden></section>
  </main>

  <!-- Floating popover for redacted span actions -->
  <div class="popover" id="entry-popover" hidden role="dialog" aria-label="Redaction actions">
    <div class="popover-arrow"></div>
    <div class="popover-field">
      <code class="popover-original" id="popover-original"></code>
    </div>
    <div class="popover-field">
      <input id="popover-replacement" type="text" autocomplete="off" aria-label="Replacement" />
    </div>
    <div class="popover-actions">
      <button type="button" class="text-button" id="popover-find">Find in list</button>
      <button type="button" class="ghost-button" id="popover-delete">Un-Redact</button>
    </div>
  </div>

  <!-- Floating Redact button for text selection -->
  <button type="button" class="redact-selection" id="redact-selection" hidden>
    <i class="ph-fill ph-highlighter" aria-hidden="true"></i>
    <span>Redact</span>
  </button>

  <!-- Overlay notifications. Never render status inside the Documents panel. -->
  <div class="toast-region" id="toast-region" aria-live="polite" aria-atomic="false"></div>
`;

/* --------------------------- Element refs -------------------------- */

const appShell = document.querySelector<HTMLElement>(".app-shell")!;
const workspaceView = document.querySelector<HTMLElement>("#workspace-view")!;
const infoView = document.querySelector<HTMLElement>("#info-view")!;
const readingProgress =
  document.querySelector<HTMLElement>("#reading-progress")!;
const siteMenuToggle =
  document.querySelector<HTMLButtonElement>("#site-menu-toggle")!;
const siteMenu = document.querySelector<HTMLElement>("#site-menu")!;
const siteMenuClose =
  document.querySelector<HTMLButtonElement>("#site-menu-close")!;
const workspaceGrid = document.querySelector<HTMLElement>("#workspace-grid")!;
const documentsToggle =
  document.querySelector<HTMLButtonElement>("#documents-toggle")!;
const redactionsToggle =
  document.querySelector<HTMLButtonElement>("#redactions-toggle")!;
const filesContent = document.querySelector<HTMLElement>("#files-content")!;
const filesBody = document.querySelector<HTMLElement>("#files-body")!;
const documentsDropzone =
  document.querySelector<HTMLElement>("#documents-dropzone")!;
const documentsDropTitle = document.querySelector<HTMLElement>(
  "[data-documents-drop-title]",
)!;
const replacementsBody =
  document.querySelector<HTMLElement>("#replacements-body")!;
const replacementsCount = document.querySelector<HTMLElement>(
  "#replacements-count",
)!;
const searchInput = document.querySelector<HTMLInputElement>("#search-input")!;
const omniboxAddAction = document.querySelector<HTMLElement>(
  "#omnibox-add-action",
)!;

const levelButtons =
  document.querySelectorAll<HTMLButtonElement>("[data-level]");
const levelActiveDesc =
  document.querySelector<HTMLElement>("#level-active-desc")!;
const previewTitle = document.querySelector<HTMLElement>("#preview-title")!;
const previewBody = document.querySelector<HTMLElement>("#preview-body")!;
const previewSearch = document.querySelector<HTMLElement>("#preview-search")!;
const previewSearchToggle = document.querySelector<HTMLButtonElement>(
  "#preview-search-toggle",
)!;
const previewSearchInput = document.querySelector<HTMLInputElement>(
  "#preview-search-input",
)!;
const previewSearchClear = document.querySelector<HTMLButtonElement>(
  "#preview-search-clear",
)!;
const previewSearchSummary = document.querySelector<HTMLElement>(
  "#preview-search-summary",
)!;
const previewSearchResults = document.querySelector<HTMLElement>(
  "#preview-search-results",
)!;
const previewVisibilityToggle = document.querySelector<HTMLButtonElement>(
  "#preview-visibility-toggle",
)!;
const copyDocButton =
  document.querySelector<HTMLButtonElement>("#copy-doc-button")!;
const downloadDocButton = document.querySelector<HTMLButtonElement>(
  "#download-doc-button",
)!;
const downloadButton =
  document.querySelector<HTMLButtonElement>("#download-button")!;
const toastRegion = document.querySelector<HTMLElement>("#toast-region")!;

const filesPanel = document.querySelector<HTMLElement>(".files-panel")!;
const replacementsPanel = document.querySelector<HTMLElement>(
  ".replacements-panel",
)!;
const resizerLeft = document.querySelector<HTMLElement>("#resizer-left")!;
const resizerRight = document.querySelector<HTMLElement>("#resizer-right")!;

const popover = document.querySelector<HTMLElement>("#entry-popover")!;
const popoverOriginal =
  document.querySelector<HTMLElement>("#popover-original")!;
const popoverReplacement = document.querySelector<HTMLInputElement>(
  "#popover-replacement",
)!;
const popoverDelete =
  document.querySelector<HTMLButtonElement>("#popover-delete")!;
const popoverFind = document.querySelector<HTMLButtonElement>("#popover-find")!;

const redactSelectionBtn =
  document.querySelector<HTMLButtonElement>("#redact-selection")!;

let pendingRedactionText = "";
let originalPreviewTimer: number | undefined;

/* ----------------------------- Routing ----------------------------- */

siteMenuToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  setInfoMenuOpen(!state.infoMenuOpen);
});

siteMenuClose.addEventListener("click", () => setInfoMenuOpen(false));

siteMenu.addEventListener("click", (event) => {
  if ((event.target as HTMLElement).closest("[data-route-link]")) {
    setInfoMenuOpen(false);
  }
});

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest(".site-menu-wrap")) return;
  if (target.closest(".site-menu")) return;
  setInfoMenuOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setInfoMenuOpen(false);
});

window.addEventListener("hashchange", () => {
  state.route = routeFromHash();
  setInfoMenuOpen(false);
  hidePopover();
  renderRoute();
});

infoView.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest(".copy-prompt-btn");
  if (!btn) return;

  const text = btn.getAttribute("data-copy-text");
  if (!text) return;

  navigator.clipboard.writeText(text).then(() => {
    btn.innerHTML = `<i class="ph ph-check" aria-hidden="true"></i>`;
    btn.classList.add("copied");
    window.setTimeout(() => {
      btn.innerHTML = `<i class="ph ph-copy" aria-hidden="true"></i>`;
      btn.classList.remove("copied");
    }, 2000);
  }).catch((err) => {
    console.error("Failed to copy text: ", err);
  });
});

function renderRoute(): void {
  const showingWorkspace = state.route === "workspace";
  workspaceView.hidden = !showingWorkspace;
  infoView.hidden = showingWorkspace;
  appShell.classList.toggle("info-page-active", !showingWorkspace);

  document.title =
    state.route === "workspace"
      ? "NoAI"
      : `${INFO_PAGE_SCAFFOLDS[state.route].title} - NoAI`;

  renderSiteMenuState();
  if (state.route !== "workspace") {
    renderInfoPage(state.route);
  } else {
    teardownReadingProgress();
  }
}

function renderInfoBlocks(blocks: InfoBlock[]): string {
  if (blocks.length === 0) return "<p>TODO: Draft this section.</p>";
  return blocks
    .map((block) => {
      if (block.type === "text") {
        return `<p>${escapeHtml(block.text)}</p>`;
      }
      if (block.type === "html") {
        return block.html;
      }
      if (block.type === "qa-html") {
        const answer = block.answerHtml
          .map((line) => `<p>${line}</p>`)
          .join("");
        return `<div class="info-qa"><h3>${escapeHtml(block.question)}</h3>${answer}</div>`;
      }
      if (block.type === "qa-rich") {
        return `<div class="info-qa"><h3>${escapeHtml(block.question)}</h3>${block.bodyHtml}</div>`;
      }
      const answer = block.answer
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join("");
      return `<div class="info-qa"><h3>${escapeHtml(block.question)}</h3>${answer}</div>`;
    })
    .join("");
}

function renderMoreByMeProjects(): string {
  const locale = preferredCatalogLocale();
  const projects = PUBLIC_PROJECTS
    .filter((project) => project.showInApps && project.id !== CURRENT_PROJECT_ID)
    .sort((a, b) => a.order - b.order);

  if (projects.length === 0) return "<p>No other public projects are listed yet.</p>";

  return `
    <div class="more-projects-list">
      ${projects.map((project) => renderProjectLink(project, locale)).join("")}
    </div>
  `;
}

function renderFieldNotesGrid(): string {
  const notes = [...FIELD_NOTES].sort((a, b) =>
    (b.dateTime || "").localeCompare(a.dateTime || ""),
  );
  return `
    <div class="field-notes-list">
      ${notes.map(renderFieldNoteRow).join("")}
    </div>
  `;
}

function renderFieldNoteRow(note: FieldNote): string {
  const dateMarkup = note.dateTime
    ? `<time class="field-note-date" datetime="${escapeHtml(note.dateTime)}">${escapeHtml(note.dateLabel)}</time>`
    : `<span class="field-note-date">${escapeHtml(note.dateLabel)}</span>`;

  return `
    <a class="field-note-row" href="${routeHrefForFieldNote(note)}">
      ${dateMarkup}
      <span class="field-note-copy">
        <span class="field-note-title">${escapeHtml(note.title)}</span>
        <span class="field-note-summary">${escapeHtml(note.summary)}</span>
      </span>
    </a>
  `;
}

function routeHrefForFieldNote(note: FieldNote): string {
  return `#/field-notes/${encodeURIComponent(note.slug)}`;
}

function renderProjectLink(project: PublicProject, locale: CatalogLocale): string {
  const href = primaryProjectLink(project);
  const name = localizedValue(project.name, locale);
  const tagline = localizedValue(project.tagline, locale);
  const alt = localizedValue(project.icon.alt, locale);
  const platforms = project.platforms.map(formatPlatform).join(", ");
  return `
    <a class="more-project-link" href="${escapeHtml(href)}" target="_blank" rel="noopener" aria-label="${escapeHtml(`${name}: ${tagline}`)}">
      <img src="${escapeHtml(project.icon.light)}" alt="${escapeHtml(alt)}" loading="lazy" />
      <span class="more-project-copy">
        <span class="more-project-name">${escapeHtml(name)}</span>
        <span class="more-project-tagline">${escapeHtml(tagline)}</span>
      </span>
      <span class="more-project-platforms">${escapeHtml(platforms)}</span>
    </a>
  `;
}

function preferredCatalogLocale(): CatalogLocale {
  const languages = navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language];
  for (const language of languages) {
    if (language.startsWith("zh-Hans") || language === "zh-CN" || language === "zh-SG") {
      return "zh-Hans";
    }
    if (language.startsWith("zh-Hant") || language === "zh-TW" || language === "zh-HK" || language === "zh-MO") {
      return "zh-Hant";
    }
    if (language.startsWith("ko")) return "ko";
    if (language.startsWith("ja")) return "ja";
    if (language.startsWith("en")) return "en";
  }
  return "en";
}

function localizedValue(values: Record<CatalogLocale, string>, locale: CatalogLocale): string {
  return values[locale] || values.en;
}

function primaryProjectLink(project: PublicProject): string {
  return (
    project.links.website ||
    project.links.appStore ||
    project.links.download ||
    project.links.github ||
    "#"
  );
}

function formatPlatform(platform: string): string {
  const labels: Record<string, string> = {
    ios: "iOS",
    macos: "macOS",
    windows: "Windows",
    linux: "Linux",
    web: "Web",
  };
  return labels[platform] ?? platform;
}

const COLLAPSED_CHANGELOG_ITEM_COUNT = 4;

function renderInfoSection(route: InfoRoute, section: InfoSection): string {
  if (route === "field-notes") {
    return `
      <section class="info-section field-notes-section">
        ${renderInfoBlocks(section.blocks)}
      </section>
    `;
  }

  const isCollapsibleChangelog =
    route === "changelog" && section.heading === "Engine changelog";
  const shouldCollapse =
    isCollapsibleChangelog &&
    !state.changelogExpanded &&
    section.blocks.length > COLLAPSED_CHANGELOG_ITEM_COUNT;
  const visibleBlocks = shouldCollapse
    ? section.blocks.slice(0, COLLAPSED_CHANGELOG_ITEM_COUNT)
    : section.blocks;
  const hiddenCount = Math.max(
    0,
    section.blocks.length - COLLAPSED_CHANGELOG_ITEM_COUNT,
  );
  const toggle =
    isCollapsibleChangelog && hiddenCount > 0
      ? `
        <button
          type="button"
          class="ghost-button info-toggle"
          data-changelog-toggle
          aria-expanded="${state.changelogExpanded}"
        >
          ${state.changelogExpanded ? "Show Less" : `Show All (${hiddenCount} more)`}
        </button>
      `
      : "";

  const id = section.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  return `
    <section id="${id}" class="info-section">
      <h2>${escapeHtml(section.heading)}</h2>
      <div class="info-section-body">
        ${renderInfoBlocks(visibleBlocks)}
        ${toggle}
      </div>
    </section>
  `;
}

function renderInfoPage(route: InfoRoute): void {
  const page = INFO_PAGE_SCAFFOLDS[route];
  const plainPage = route === "about";
  const backHref = route === "field-note-template" ? "#/field-notes" : "#/";
  const backLabel =
    route === "field-note-template" ? "Back to Field Notes" : "Back to workspace";
  const sectionContent =
    route === "field-note-template"
      ? renderFieldNoteArticle(FIELD_NOTE_TEMPLATE)
      : `
          <div class="info-section-list">
            ${page.sections
              .map((section) => renderInfoSection(route, section))
              .join("")}
          </div>
        `;
  const versionMeta =
    route === "changelog"
      ? `
        <dl class="version-grid">
          <div>
            <dt>App version</dt>
            <dd>${escapeHtml(APP_VERSION)}</dd>
          </div>
          <div>
            <dt>Engine version</dt>
            <dd>${escapeHtml(ENGINE_VERSION)}</dd>
          </div>
          <div>
            <dt>Engine date</dt>
            <dd>${escapeHtml(ENGINE_VERSION_DATE)}</dd>
          </div>
        </dl>
      `
      : "";

  infoView.innerHTML = `
    <article class="info-page info-page-${route}${plainPage ? " info-page--plain" : ""}" aria-labelledby="info-title">
      <div class="info-page-layout">
        <div class="info-content-wrap">
          <header class="info-hero">
            <a class="info-back-link" href="${backHref}">
              <i class="ph ph-arrow-left" aria-hidden="true"></i>
              <span>${backLabel}</span>
            </a>
            <h1 id="info-title">${escapeHtml(page.title)}</h1>
            ${renderInfoHeroSummary(route, page.summary)}
            ${versionMeta}
          </header>
          ${sectionContent}
          <footer class="info-footer">
            ${SITE_LINKS.map(
              (link) =>
                `<a href="${routeHref(link.route)}">${escapeHtml(link.label)}</a>`,
            ).join("")}
          </footer>
        </div>
      </div>
    </article>
  `;
  infoView
    .querySelector<HTMLButtonElement>("[data-changelog-toggle]")
    ?.addEventListener("click", () => {
      state.changelogExpanded = !state.changelogExpanded;
      renderInfoPage(route);
    });

  setupReadingProgress();
}

let readingProgressAbortController: AbortController | null = null;
const READING_PROGRESS_MIN_SCROLL_RANGE = 480;

function teardownReadingProgress(): void {
  readingProgressAbortController?.abort();
  readingProgressAbortController = null;
  readingProgress.hidden = true;
  readingProgress.style.setProperty("--reading-progress", "0");
}

function setupReadingProgress(): void {
  teardownReadingProgress();
  readingProgressAbortController = new AbortController();

  const updateProgress = () => {
    const scrollRange = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    const shouldShow =
      state.route !== "workspace" &&
      scrollRange >= READING_PROGRESS_MIN_SCROLL_RANGE;

    readingProgress.hidden = !shouldShow;
    if (!shouldShow) {
      readingProgress.style.setProperty("--reading-progress", "0");
      return;
    }

    const progress = Math.min(1, Math.max(0, window.scrollY / scrollRange));
    readingProgress.style.setProperty("--reading-progress", String(progress));
  };

  window.addEventListener("scroll", updateProgress, {
    signal: readingProgressAbortController.signal,
    passive: true,
  });
  window.addEventListener("resize", updateProgress, {
    signal: readingProgressAbortController.signal,
    passive: true,
  });
  updateProgress();
}

function setInfoMenuOpen(open: boolean): void {
  state.infoMenuOpen = open;
  renderSiteMenuState();
}

function renderSiteMenuState(): void {
  document.body.classList.toggle("site-menu-open", state.infoMenuOpen);
  siteMenu.classList.toggle("open", state.infoMenuOpen);
  siteMenu.setAttribute("aria-hidden", String(!state.infoMenuOpen));
  siteMenu.toggleAttribute("inert", !state.infoMenuOpen);
  siteMenuToggle.setAttribute("aria-expanded", String(state.infoMenuOpen));
  siteMenuToggle.setAttribute(
    "aria-label",
    state.infoMenuOpen ? "Close site menu" : "Open site menu",
  );
  const menuIcon = siteMenuToggle.querySelector("i");
  if (menuIcon) {
    menuIcon.className = state.infoMenuOpen ? "ph ph-x" : "ph ph-list";
  }
  siteMenu
    .querySelectorAll<HTMLAnchorElement>("[data-route-link]")
    .forEach((link) => {
      const active =
        link.dataset.routeLink === state.route ||
        (state.route === "field-note-template" &&
          link.dataset.routeLink === "field-notes");
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
}

function renderSiteMenuLinks(): string {
  return SITE_MENU_LINKS.map(
    (link) => `
      <a href="${routeHref(link.route)}" data-route-link="${link.route}">
        <span>${escapeHtml(link.label)}</span>
      </a>
    `,
  ).join("");
}

function routeFromHash(): AppRoute {
  const route = window.location.hash.replace(/^#\/?/, "").split("#")[0];
  if (route === "field-notes/template") return "field-note-template";
  if (route === "field-notes") return "field-notes";
  if (route === "faq") return "faq";
  if (route === "about") return "about";
  if (route === "privacy") return "privacy";
  if (route === "terms") return "terms";
  if (route === "changelog") return "changelog";
  return "workspace";
}

function routeHref(route: AppRoute): string {
  if (route === "field-note-template") return "#/field-notes/template";
  return route === "workspace" ? "#/" : `#/${route}`;
}

/* ----------------------- Dropzone / file input --------------------- */

document.querySelectorAll<HTMLElement>("[data-dropzone]").forEach((zone) => {
  const input = zone.querySelector<HTMLInputElement>(
    ":scope > [data-file-input]",
  );
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("dragging");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragging"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    zone.classList.remove("dragging");
    const files = Array.from(event.dataTransfer?.files ?? []);
    void handleFiles(files);
  });
  if (input) {
    input.addEventListener("change", () => {
      const files = Array.from(input.files ?? []);
      input.value = "";
      void handleFiles(files);
    });
  }
});

async function handleFiles(fileList: File[]): Promise<void> {
  const supported = fileList.filter(isSupportedFile);
  const unsupported = fileList.filter((file) => !isSupportedFile(file));
  const unsupportedMessage = unsupportedFileMessage(unsupported);

  if (supported.length === 0) {
    if (fileList.length > 0) setStatus(unsupportedMessage);
    return;
  }

  setBusy(true, "Reading files locally…");
  try {
    const readResults = await readFiles(supported);
    for (const result of readResults) {
      state.documents.push({
        id: nextDocId(),
        fileName: result.name,
        text: result.text,
        warnings: result.warnings,
      });
    }
    ensureSelectedDocument();
    setStatus(
      unsupportedMessage
        ? `Read ${pluralize(readResults.length, "file")} locally. ${unsupportedMessage}`
        : `Read ${pluralize(readResults.length, "file")} locally.`,
    );
    recompute();
    renderAll();
  } catch (error) {
    setStatus(
      error instanceof Error
        ? error.message
        : "Something went wrong while reading files.",
    );
  } finally {
    setBusy(false);
  }
}

/* --------------------------- Engine bridge ------------------------- */

/** Re-run detection across all loaded documents, merging current user entries.
 *  Updates `state.review` and `state.entries` but does not touch the DOM. */
function recompute(): void {
  ensureSelectedDocument();
  if (state.documents.length === 0) {
    state.review = null;
    state.entries = [];
    state.removedEntryIds.clear();
    return;
  }
  const inputs = state.documents.map((doc) => ({
    name: doc.fileName,
    text: doc.text,
  }));
  const result = redactDocuments(inputs, {
    level: state.level,
    entries: state.entries,
    removedEntryIds: [...state.removedEntryIds],
  });
  state.review = result;
  state.entries = result.entries;
}

/* ----------------------------- Actions ----------------------------- */

levelButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.level = button.dataset.level as RedactionLevel;
    recompute();
    renderAll();
  });
});

searchInput.addEventListener("input", () => {
  state.query = searchInput.value.trim().toLowerCase();
  renderReplacements();
});

previewSearchInput.addEventListener("input", () => {
  state.previewQuery = previewSearchInput.value.trim();
  renderPreview();
});

previewSearchToggle.addEventListener("click", () => {
  state.showPreviewSearch = !state.showPreviewSearch;
  renderPreview();
  if (state.showPreviewSearch) {
    window.requestAnimationFrame(() => previewSearchInput.focus());
  }
});

previewSearchClear.addEventListener("click", () => {
  state.previewQuery = "";
  previewSearchInput.value = "";
  renderPreview();
  previewSearchInput.focus();
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const trimmed = searchInput.value.trim();
    if (!trimmed) return;
    const showAdd = !state.entries.some(
      (entry) => entry.value.toLowerCase() === trimmed.toLowerCase(),
    );
    if (showAdd) {
      event.preventDefault();
      addManualEntry(trimmed);
      searchInput.value = "";
      state.query = "";
      renderReplacements();
      searchInput.focus();
    }
  }
});

omniboxAddAction.addEventListener("click", () => {
  const trimmed = searchInput.value.trim();
  if (!trimmed) return;
  const showAdd = !state.entries.some(
    (entry) => entry.value.toLowerCase() === trimmed.toLowerCase(),
  );
  if (showAdd) {
    addManualEntry(trimmed);
    searchInput.value = "";
    state.query = "";
    renderReplacements();
    searchInput.focus();
  }
});

downloadButton.addEventListener("click", () => {
  if (!state.review) return;
  downloadText(state.review.combinedMarkdown, "redacted-document-pack.md");
});

copyDocButton.addEventListener("click", () => {
  const reviewDoc = selectedReviewDoc();
  if (!reviewDoc) return;
  navigator.clipboard
    .writeText(reviewDoc.sanitized)
    .then(() => {
      showToast("Copied to clipboard!");
    })
    .catch(() => {
      showToast("Failed to copy text.");
    });
});

previewVisibilityToggle.addEventListener("click", () => {
  if (!selectedReviewDoc()) return;
  if (state.showOriginalPreview) {
    hideOriginalPreview();
  } else {
    showOriginalPreview();
  }
});

downloadDocButton.addEventListener("click", () => {
  const loaded = selectedLoadedDoc();
  const reviewDoc = selectedReviewDoc();
  if (!loaded || !reviewDoc) return;
  downloadText(reviewDoc.sanitized, sanitizedFilename(loaded.fileName));
});

documentsToggle.addEventListener("click", () => {
  state.documentsCollapsed = !state.documentsCollapsed;
  renderFiles();
});

redactionsToggle.addEventListener("click", () => {
  state.redactionsCollapsed = !state.redactionsCollapsed;
  renderReplacements();
});

/* --------------------------- Resizing ------------------------------ */

let isResizing = false;
let currentResizer: "left" | "right" | null = null;
let startX = 0;
let startWidth1 = 0;
let startWidth3 = 0;

resizerLeft.addEventListener("mousedown", (e) => {
  if (state.documentsCollapsed) return;
  isResizing = true;
  currentResizer = "left";
  resizerLeft.classList.add("active");
  startX = e.clientX;
  startWidth1 = filesPanel.getBoundingClientRect().width;
  document.body.classList.add("resizing-col");
});

resizerRight.addEventListener("mousedown", (e) => {
  if (state.redactionsCollapsed) return;
  isResizing = true;
  currentResizer = "right";
  resizerRight.classList.add("active");
  startX = e.clientX;
  startWidth3 = replacementsPanel.getBoundingClientRect().width;
  document.body.classList.add("resizing-col");
});

window.addEventListener("mousemove", (e) => {
  if (!isResizing || !currentResizer) return;
  const dx = e.clientX - startX;
  if (currentResizer === "left") {
    const newWidth = Math.max(200, Math.min(startWidth1 + dx, 800));
    workspaceGrid.style.setProperty("--col-1-width", `${newWidth}px`);
  } else {
    // For right resizer, moving left (negative dx) increases right panel width
    const newWidth = Math.max(250, Math.min(startWidth3 - dx, 800));
    workspaceGrid.style.setProperty("--col-3-width", `${newWidth}px`);
  }
});

window.addEventListener("mouseup", () => {
  if (isResizing) {
    isResizing = false;
    currentResizer = null;
    resizerLeft.classList.remove("active");
    resizerRight.classList.remove("active");
    document.body.classList.remove("resizing-col");
  }
});

/* ----- Replacement edits (keep focus, only refresh preview) ----- */

let previewUpdateTimer: number | undefined;
function schedulePreviewUpdate(): void {
  window.clearTimeout(previewUpdateTimer);
  previewUpdateTimer = window.setTimeout(() => {
    recompute();
    renderPreview();
  }, 120);
}

function setEntryReplacement(id: string, replacement: string): void {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  entry.replacement = replacement;
  schedulePreviewUpdate();
}

function deleteEntry(id: string): void {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  state.removedEntryIds.add(id);
  state.entries = state.entries.filter((item) => item.id !== id);
  if (state.selectedEntryId === id) hidePopover();
  recompute();
  renderAll();
  setStatus(`Deleted replacement for "${entry.value}".`);
}

function deleteEntries(ids: string[], label: string): void {
  const idSet = new Set(ids);
  const entries = state.entries.filter((item) => idSet.has(item.id));
  if (entries.length === 0) return;
  entries.forEach((entry) => state.removedEntryIds.add(entry.id));
  state.entries = state.entries.filter((item) => !idSet.has(item.id));
  if (state.selectedEntryId && idSet.has(state.selectedEntryId)) hidePopover();
  recompute();
  renderAll();
  setStatus(
    `Deleted ${entries.length} ${
      entries.length === 1 ? "replacement" : "replacements"
    } in ${label}.`,
  );
}

/* --------------------------- Manual entries ------------------------ */

function addManualEntry(
  value: string,
  renderMode: "all" | "preview" = "all",
): { id: string; added: boolean } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const id = manualEntryId(trimmed);
  const existing = state.entries.find((entry) => entry.id === id);
  if (existing) {
    recompute();
    if (renderMode === "preview") renderPreview();
    else renderAll();
    return { id, added: false };
  }
  state.removedEntryIds.delete(id);
  const entry: ReplacementEntry = {
    id,
    value: trimmed,
    replacement: nextCustomReplacement(),
    kind: "CUSTOM",
    level: "light",
    reason: "manual",
    sources: ["manual"],
    count: 0,
    manual: true,
    matchCase: false,
  };
  state.entries.push(entry);
  recompute();
  if (renderMode === "preview") renderPreview();
  else renderAll();
  setStatus(`Added manual redaction for "${trimmed}".`);
  return { id, added: true };
}

function manualEntryId(value: string): string {
  return `CUSTOM:${encodeURIComponent(value)}`;
}

function nextCustomReplacement(): string {
  let max = 0;
  for (const entry of state.entries) {
    const match = /^CUSTOM_(\d+)$/.exec(entry.replacement);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `CUSTOM_${String(max + 1).padStart(3, "0")}`;
}

/* ------------------------- Document actions ------------------------ */

function selectDocument(id: string): void {
  if (!state.documents.some((doc) => doc.id === id)) return;
  state.selectedDocumentId = id;
  hideOriginalPreview({ silent: true });
  hidePopover();
  renderFiles();
  renderPreview();
}

function removeDocument(id: string): void {
  const index = state.documents.findIndex((doc) => doc.id === id);
  if (index === -1) return;
  state.documents.splice(index, 1);
  if (state.selectedDocumentId === id) {
    const next = state.documents[index] ?? state.documents[index - 1] ?? null;
    state.selectedDocumentId = next ? next.id : null;
  }
  ensureSelectedDocument();
  hideOriginalPreview({ silent: true });
  hidePopover();
  recompute();
  renderAll();
}

/* ---------------------------- Rendering ---------------------------- */

function renderAll(): void {
  ensureSelectedDocument();
  renderWorkspaceState();
  renderFiles();
  renderLevelControl();
  renderReplacements();
  renderPreview();
}

function ensureSelectedDocument(): void {
  if (state.documents.length === 0) {
    state.selectedDocumentId = null;
    return;
  }
  const selectedDocExists = state.documents.some(
    (doc) => doc.id === state.selectedDocumentId,
  );
  if (!selectedDocExists) {
    state.selectedDocumentId = state.documents[0].id;
  }
}

function renderWorkspaceState(): void {
  const hasDocs = state.documents.length > 0;
  workspaceGrid.hidden = false;
  workspaceGrid.classList.toggle(
    "documents-collapsed",
    state.documentsCollapsed,
  );
  workspaceGrid.classList.toggle(
    "redactions-collapsed",
    state.redactionsCollapsed,
  );
  documentsDropzone.classList.toggle("dropzone-empty", !hasDocs);
  documentsDropzone.classList.toggle("dropzone-small", hasDocs);
  documentsDropTitle.classList.toggle("drop-title", !hasDocs);
  documentsDropTitle.classList.toggle("drop-meta", hasDocs);
  documentsDropTitle.textContent = hasDocs
    ? "Add more documents"
    : "Add Documents to Start";
  documentsDropzone
    .querySelectorAll<HTMLElement>("[data-empty-only]")
    .forEach((element) => {
      element.hidden = hasDocs;
    });
  downloadButton.disabled = !hasDocs || !state.review;

  const downloadText = downloadButton.querySelector("span");
  if (downloadText) {
    downloadText.textContent =
      state.documents.length === 1 ? "Markdown" : "Combined Markdown";
  }
}

function selectedLoadedDoc(): LoadedDocument | undefined {
  return state.documents.find((doc) => doc.id === state.selectedDocumentId);
}

function selectedReviewDoc() {
  if (!state.review) return undefined;
  const loaded = selectedLoadedDoc();
  if (!loaded) return undefined;
  const index = state.documents.findIndex((doc) => doc.id === loaded.id);
  return state.review.documents[index];
}

function renderFiles(): void {
  workspaceGrid.classList.toggle(
    "documents-collapsed",
    state.documentsCollapsed,
  );
  documentsToggle.setAttribute(
    "aria-expanded",
    String(!state.documentsCollapsed),
  );
  documentsToggle.setAttribute(
    "aria-label",
    state.documentsCollapsed
      ? "Expand documents sidebar"
      : "Collapse documents sidebar",
  );
  if (state.documents.length === 0) {
    filesBody.innerHTML = "";
    return;
  }
  filesBody.innerHTML = state.documents
    .map((doc) => {
      const isSelected = doc.id === state.selectedDocumentId;
      const selected = isSelected ? " selected" : "";
      const disabled = isSelected ? " disabled" : "";
      const current = isSelected ? ` aria-current="true"` : "";
      const warningLine =
        doc.warnings.length > 0
          ? `<span class="file-warning" title="${escapeHtml(doc.warnings.join("; "))}">${icon.alert}<span>${escapeHtml(String(doc.warnings.length))}</span></span>`
          : "";
      return `
        <div class="file-row${selected}" data-doc-id="${escapeHtml(doc.id)}">
          <button type="button" class="file-select" data-doc-id="${escapeHtml(doc.id)}"${disabled}${current}>
            ${fileFormatIcon(doc.fileName)}
            <span class="file-name">${escapeHtml(doc.fileName)}</span>
            ${warningLine}
          </button>
          <button type="button" class="file-remove" data-doc-id="${escapeHtml(doc.id)}" aria-label="Remove ${escapeHtml(doc.fileName)}">${icon.trash}</button>
        </div>
      `;
    })
    .join("");

  filesBody
    .querySelectorAll<HTMLButtonElement>(".file-select")
    .forEach((button) => {
      if (button.disabled) return;
      button.addEventListener("click", () =>
        selectDocument(button.dataset.docId!),
      );
    });
  filesBody
    .querySelectorAll<HTMLButtonElement>(".file-remove")
    .forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        removeDocument(button.dataset.docId!);
      });
    });
}

function fileFormatIcon(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const iconClass =
    extension === "md" || extension === "markdown"
      ? "ph-file-md"
      : extension === "txt"
        ? "ph-file-txt"
        : extension === "docx"
          ? "ph-file-doc"
          : extension === "pdf"
            ? "ph-file-pdf"
            : "ph-file";
  return `<i class="file-format-icon ph ${iconClass}" aria-hidden="true"></i>`;
}

function renderReplacements(): void {
  workspaceGrid.classList.toggle(
    "redactions-collapsed",
    state.redactionsCollapsed,
  );
  redactionsToggle.setAttribute(
    "aria-expanded",
    String(!state.redactionsCollapsed),
  );
  redactionsToggle.setAttribute(
    "aria-label",
    state.redactionsCollapsed
      ? "Expand redactions sidebar"
      : "Collapse redactions sidebar",
  );
  const entries = state.review
    ? state.review.entries.filter((entry) => entry.count > 0)
    : [];
  const filtered = entries.filter((entry) => matchesQuery(entry, state.query));
  replacementsCount.textContent = "";

  if (entries.length === 0) {
    replacementsBody.innerHTML =
      state.documents.length === 0
        ? `<p class="placeholder empty-panel-placeholder">Add a document to start.</p>`
        : `<p class="placeholder">No sensitive terms detected.</p>`;
    return;
  }
  if (filtered.length === 0) {
    replacementsBody.innerHTML = `<p class="placeholder">No replacements match "${escapeHtml(state.query)}".</p>`;
    return;
  }

  const groups = groupByKind(filtered);
  const orderedKinds = Object.keys(groups).sort(sortKinds);
  const footerText = formatReplacementTotals(filtered);

  replacementsBody.innerHTML = `
    ${orderedKinds
      .map((kind) => {
        const items = groups[kind];
        const collapsed = !state.expandedKinds.has(kind);
        const style = kindStyle(kind);
        return `
          <section class="cat-group" data-kind="${escapeHtml(kind)}">
            <div class="cat-head-row">
              <button type="button" class="cat-head cat-head-name${collapsed ? " collapsed" : ""}" data-toggle-kind="${escapeHtml(kind)}">
                <span class="cat-name" style="${style.labelCss}">${escapeHtml(kindLabel(kind))}</span>
              </button>
              <button
                type="button"
                class="cat-delete"
                data-delete-kind="${escapeHtml(kind)}"
                aria-label="Un-redact all listed ${escapeHtml(kindLabel(kind))} replacements"
              >${icon.x}</button>
              <button type="button" class="cat-head cat-head-meta${collapsed ? " collapsed" : ""}" data-toggle-kind="${escapeHtml(kind)}" aria-label="Toggle ${escapeHtml(kindLabel(kind))} replacements">
                <span class="cat-count">${items.length}</span>
                <span class="cat-chevron">${icon.chevronDown}</span>
              </button>
            </div>
            <div class="cat-items-grid${collapsed ? " collapsed" : ""}">
              <div class="cat-items">${items.map((entry, i) => renderEntryRow(entry, i)).join("")}</div>
            </div>
          </section>
        `;
      })
      .join("")}
    <div class="replacements-footer" aria-label="${escapeHtml(footerText)}">
      ${escapeHtml(footerText)}
    </div>
  `;

  replacementsBody
    .querySelectorAll<HTMLButtonElement>("[data-toggle-kind]")
    .forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const kind = button.dataset.toggleKind!;
        const section = button.closest(".cat-group")!;
        toggleCategory(section, kind);
      });
    });

  replacementsBody
    .querySelectorAll<HTMLElement>(".cat-head-row")
    .forEach((row) => {
      row.addEventListener("click", (event) => {
        if ((event.target as HTMLElement).closest(".cat-delete")) return;
        const section = row.closest(".cat-group")!;
        toggleCategory(section, section.getAttribute("data-kind")!);
      });
    });

  replacementsBody
    .querySelectorAll<HTMLButtonElement>("[data-delete-kind]")
    .forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const section = button.closest(".cat-group")!;
        const ids = [...section.querySelectorAll<HTMLElement>("[data-delete-entry]")].map(
          (entryButton) => entryButton.dataset.deleteEntry!,
        );
        deleteEntries(ids, kindLabel(button.dataset.deleteKind!));
      });
    });

  replacementsBody
    .querySelectorAll<HTMLInputElement>("[data-replacement-input]")
    .forEach((input) => {
      input.addEventListener("input", () =>
        setEntryReplacement(input.dataset.replacementInput!, input.value),
      );
    });
  replacementsBody
    .querySelectorAll<HTMLButtonElement>("[data-delete-entry]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        deleteEntry(button.dataset.deleteEntry!);
      });
    });
  replacementsBody
    .querySelectorAll<HTMLElement>("[data-jump-entry]")
    .forEach((row) => {
      row.addEventListener("click", (event) => {
        if ((event.target as HTMLElement).closest("input, button")) return;
        const id = row.dataset.jumpEntry!;
        jumpToEntryInPreview(id);
      });
    });
  updateOmniboxAddAction();
}

function toggleCategory(section: Element, kind: string): void {
  const grid = section.querySelector(".cat-items-grid")!;
  const toggles = section.querySelectorAll<HTMLButtonElement>("[data-toggle-kind]");
  if (state.expandedKinds.has(kind)) {
    state.expandedKinds.delete(kind);
    toggles.forEach((toggle) => toggle.classList.add("collapsed"));
    grid.classList.add("collapsed");
  } else {
    state.expandedKinds.add(kind);
    toggles.forEach((toggle) => toggle.classList.remove("collapsed"));
    grid.classList.remove("collapsed");
  }
}

function updateOmniboxAddAction(): void {
  const trimmed = searchInput.value.trim();
  const showAdd =
    trimmed !== "" &&
    !state.entries.some(
      (entry) => entry.value.toLowerCase() === trimmed.toLowerCase(),
    );
  if (showAdd) {
    omniboxAddAction.removeAttribute("hidden");
  } else {
    omniboxAddAction.setAttribute("hidden", "");
  }
}

function renderEntryRow(entry: ReplacementEntry, index: number = 0): string {
  const style = kindStyle(entry.kind);
  const hitTitle = `${entry.count} ${entry.count === 1 ? "hit" : "hits"}`;
  return `
    <div class="entry-row" data-jump-entry="${escapeHtml(entry.id)}" style="--anim-index: ${index}">
      <span class="entry-hit-count" aria-label="${escapeHtml(hitTitle)}">${escapeHtml(formatHitMultiplier(entry))}</span>
      <div class="entry-source">
        <s class="entry-value" style="--strike-color: ${style.color}">${escapeHtml(entry.value)}</s>
      </div>
      <div class="entry-controls">
        <button
          type="button"
          class="entry-delete"
          data-delete-entry="${escapeHtml(entry.id)}"
          aria-label="Un-redact ${escapeHtml(entry.value)}"
        >${icon.x}</button>
        <input
          type="text"
          class="entry-replacement"
          data-replacement-input="${escapeHtml(entry.id)}"
          value="${escapeHtml(entry.replacement)}"
          aria-label="Replacement for ${escapeHtml(entry.value)}"
          autocomplete="off"
        />
      </div>
    </div>
  `;
}

function renderInfoHeroSummary(route: InfoRoute, summary: string): string {
  if (route === "field-note-template") {
    return `
      <p class="field-note-detail-meta">${escapeHtml(FIELD_NOTE_TEMPLATE.dateLabel)}</p>
      <p>${escapeHtml(summary)}</p>
    `;
  }
  if (route === "field-notes") {
    return `<p>${escapeHtml(summary)}</p>`;
  }
  if (route !== "about") return "";
  return `
    <p>App ${escapeHtml(APP_VERSION)} · Engine ${escapeHtml(ENGINE_VERSION)} · <a href="#/changelog">History</a></p>
  `;
}

function renderPreview(): void {
  const reviewDoc = selectedReviewDoc();
  previewTitle.textContent = "Preview";
  previewVisibilityToggle.disabled = !reviewDoc;
  previewVisibilityToggle.classList.toggle("active", state.showOriginalPreview);
  previewVisibilityToggle.setAttribute(
    "aria-pressed",
    String(state.showOriginalPreview),
  );
  previewVisibilityToggle.setAttribute(
    "aria-label",
    state.showOriginalPreview ? "Hide original text" : "Show original text",
  );
  previewVisibilityToggle.title = state.showOriginalPreview
    ? "Hide original text"
    : "Show original text";
  const toggleIcon = previewVisibilityToggle.querySelector("i");
  if (toggleIcon) {
    toggleIcon.className = state.showOriginalPreview
      ? "ph ph-eye-slash"
      : "ph ph-eye";
  }
  previewSearchToggle.disabled = !reviewDoc;
  previewSearchToggle.classList.toggle("active", state.showPreviewSearch);
  previewSearchToggle.setAttribute(
    "aria-pressed",
    String(state.showPreviewSearch),
  );
  previewSearchToggle.setAttribute(
    "aria-label",
    state.showPreviewSearch ? "Hide preview search" : "Show preview search",
  );
  previewSearchToggle.title = state.showPreviewSearch
    ? "Hide preview search"
    : "Show preview search";
  copyDocButton.disabled = !reviewDoc;
  downloadDocButton.disabled = !reviewDoc;
  previewSearchInput.disabled = !reviewDoc;
  previewSearchClear.hidden = state.previewQuery.length === 0;
  previewSearch.hidden = !reviewDoc || !state.showPreviewSearch;

  if (!reviewDoc) {
    previewBody.innerHTML = `<p class="placeholder empty-panel-placeholder">Add a document to start.</p>`;
    renderPreviewSearch();
    return;
  }

  const fragment = document.createDocumentFragment();
  const query = state.showPreviewSearch ? state.previewQuery : "";
  const searchSource = state.showOriginalPreview ? "original" : "redacted";
  const hitIndex = { value: 0 };
  for (const segment of reviewDoc.segments) {
    if (state.showOriginalPreview) {
      appendHighlightedText(
        fragment,
        segment.value ?? segment.text,
        query,
        searchSource,
        hitIndex,
      );
    } else if (segment.entryId) {
      const style = kindStyle(segment.kind ?? "PROPER_NOUN");
      const span = document.createElement("span");
      span.className = "redacted";
      span.dataset.entryId = segment.entryId;
      span.title = `Original: ${segment.value ?? ""}`;
      span.setAttribute("tabindex", "0");
      span.setAttribute("role", "button");
      span.setAttribute(
        "aria-label",
        `Redacted term. Original: ${segment.value ?? ""}. Activate to edit.`,
      );
      span.setAttribute("style", style.spanCss);
      appendHighlightedText(
        span,
        segment.replacement ?? segment.text,
        query,
        searchSource,
        hitIndex,
      );
      fragment.appendChild(span);
    } else {
      appendHighlightedText(
        fragment,
        segment.text,
        query,
        searchSource,
        hitIndex,
      );
    }
  }
  previewBody.innerHTML = "";
  previewBody.appendChild(fragment);
  renderPreviewSearch();
}

function renderPreviewSearch(): void {
  const reviewDoc = selectedReviewDoc();
  const query = state.previewQuery.trim();
  if (!reviewDoc || !state.showPreviewSearch) {
    previewSearch.classList.remove("has-results");
    previewSearchSummary.hidden = false;
    previewSearchSummary.textContent = "";
    previewSearchResults.hidden = true;
    previewSearchResults.innerHTML = "";
    return;
  }

  if (!query) {
    previewSearch.classList.remove("has-results");
    previewSearchSummary.hidden = true;
    previewSearchSummary.textContent = "";
    previewSearchResults.hidden = true;
    previewSearchResults.innerHTML = "";
    return;
  }

  const buckets = previewSearchBuckets(reviewDoc, query);
  const totalHits =
    buckets.nonRedactedHits.length +
    buckets.redactedOriginalHits.length +
    buckets.redactionOnlyHits.length;
  if (totalHits === 0) {
    previewSearch.classList.remove("has-results");
    previewSearchSummary.hidden = false;
    previewSearchSummary.textContent =
      "No matches in the redacted output or original text.";
    previewSearchResults.hidden = true;
    previewSearchResults.innerHTML = "";
    return;
  }

  previewSearch.classList.add("has-results");
  previewSearchSummary.textContent = "";
  previewSearchSummary.hidden = true;
  previewSearchResults.hidden = false;
  previewSearchResults.innerHTML = renderPreviewSearchResults(buckets);
  previewSearchResults
    .querySelectorAll<HTMLButtonElement>("[data-search-jump]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        jumpToSearchHit(button.dataset.searchJump!);
      });
    });
  previewSearchResults
    .querySelectorAll<HTMLButtonElement>("[data-search-toggle-more]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        togglePreviewSearchMore(button);
      });
    });
}

function renderPreviewSearchResults(buckets: PreviewSearchBuckets): string {
  const { nonRedactedHits, redactedOriginalHits, redactionOnlyHits } = buckets;
  const originalHitCount = nonRedactedHits.length + redactedOriginalHits.length;

  if (nonRedactedHits.length === 0 && redactionOnlyHits.length === 0) {
    return renderPreviewSearchGroup(
      `No matches in the redacted text. ${redactedOriginalStatus(redactedOriginalHits.length, true)}`,
      redactedOriginalHits,
      "success",
    );
  }

  if (originalHitCount === 0) {
    return renderPreviewSearchGroup(
      `No matches in original. ${redactionsOnlyStatus(redactionOnlyHits.length)}`,
      redactionOnlyHits,
    );
  }

  if (redactedOriginalHits.length === 0 && redactionOnlyHits.length === 0) {
    return renderPreviewSearchGroup(
      nonRedactedStatus(nonRedactedHits.length, true),
      nonRedactedHits,
      "danger",
    );
  }

  const sections: string[] = [];
  if (nonRedactedHits.length > 0) {
    sections.push(
      renderPreviewSearchGroup(
        nonRedactedStatus(nonRedactedHits.length, false),
        nonRedactedHits,
        "danger",
      ),
    );
  }
  if (redactedOriginalHits.length > 0) {
    sections.push(
      renderPreviewSearchGroup(
        redactedOriginalStatus(redactedOriginalHits.length, false),
        redactedOriginalHits,
      ),
    );
  }
  if (redactionOnlyHits.length > 0) {
    sections.push(
      renderPreviewSearchGroup(
        redactionsOnlyStatus(redactionOnlyHits.length),
        redactionOnlyHits,
      ),
    );
  }
  return sections.join("");
}

function renderPreviewSearchGroup(
  statusHtml: string,
  hits: PreviewSearchHit[],
  tone: "neutral" | "success" | "danger" = "neutral",
): string {
  const visibleLimit = 8;
  const remaining = Math.max(0, hits.length - visibleLimit);
  return `
    <div class="preview-search-block ${tone}">
      <p class="preview-search-status ${tone}">${statusHtml}</p>
      ${
        hits.length > 0
          ? hits
              .map((hit, index) =>
                renderPreviewSearchHit(hit, index >= visibleLimit),
              )
              .join("")
          : ""
      }
      ${
        remaining > 0
          ? `<button type="button" class="preview-search-more" data-search-toggle-more data-more-count="${remaining}" aria-expanded="false">${escapeHtml(`Show ${formatMoreMatches(remaining)}`)}</button>`
          : ""
      }
    </div>
  `;
}

function renderPreviewSearchHit(hit: PreviewSearchHit, hidden = false): string {
  const label =
    hit.context === "redaction-only"
      ? "Redaction"
      : hit.source === "redacted"
        ? "Visible"
        : "Redacted";
  return `
    <button type="button" class="preview-search-hit-row ${hit.source} ${hit.context}" data-search-jump="${escapeHtml(hit.id)}"${hidden ? " data-extra-hit hidden" : ""}>
      <span class="preview-search-source">${label}</span>
      <span class="preview-search-snippet">${renderSnippet(hit)}</span>
    </button>
  `;
}

function togglePreviewSearchMore(button: HTMLButtonElement): void {
  const block = button.closest(".preview-search-block");
  if (!block) return;
  const expanded = button.getAttribute("aria-expanded") === "true";
  const nextExpanded = !expanded;
  block
    .querySelectorAll<HTMLButtonElement>("[data-extra-hit]")
    .forEach((row) => {
      row.hidden = !nextExpanded;
    });
  button.setAttribute("aria-expanded", String(nextExpanded));
  const moreCount = Number(button.dataset.moreCount ?? "0");
  button.textContent = nextExpanded
    ? "Show less"
    : `Show ${formatMoreMatches(moreCount)}`;
}

function renderSnippet(hit: PreviewSearchHit): string {
  return `${hit.leadingEllipsis ? "..." : ""}${escapeHtml(hit.before)}<mark>${escapeHtml(hit.match)}</mark>${escapeHtml(hit.after)}${
    hit.trailingEllipsis ? "..." : ""
  }`;
}

interface PreviewSearchHit {
  id: string;
  source: "redacted" | "original";
  context: "non-redacted" | "redacted-original" | "redaction-only";
  before: string;
  match: string;
  after: string;
  leadingEllipsis: boolean;
  trailingEllipsis: boolean;
}

interface PreviewSearchBuckets {
  nonRedactedHits: PreviewSearchHit[];
  redactedOriginalHits: PreviewSearchHit[];
  redactionOnlyHits: PreviewSearchHit[];
}

interface PreviewSearchTextRange {
  start: number;
  end: number;
  redactedSegment: boolean;
}

interface PreviewSearchTextModel {
  text: string;
  ranges: PreviewSearchTextRange[];
}

function appendHighlightedText(
  parent: Node,
  text: string,
  query: string,
  source: "redacted" | "original",
  hitIndex: { value: number },
): void {
  const matches = findQueryMatches(text, query);
  if (matches.length === 0) {
    parent.appendChild(document.createTextNode(text));
    return;
  }
  let position = 0;
  for (const match of matches) {
    if (match.start > position) {
      parent.appendChild(
        document.createTextNode(text.slice(position, match.start)),
      );
    }
    const mark = document.createElement("mark");
    mark.className = "preview-search-mark";
    mark.dataset.searchResultId = `${source}-${hitIndex.value}`;
    mark.textContent = text.slice(match.start, match.end);
    parent.appendChild(mark);
    hitIndex.value += 1;
    position = match.end;
  }
  if (position < text.length) {
    parent.appendChild(document.createTextNode(text.slice(position)));
  }
}

function previewSearchBuckets(
  reviewDoc: NonNullable<ReturnType<typeof selectedReviewDoc>>,
  query: string,
): PreviewSearchBuckets {
  const redactedText = previewSearchTextModel(reviewDoc, "redacted");
  const originalText = previewSearchTextModel(reviewDoc, "original");
  const redactedHits = findSearchHits(redactedText, query, "redacted");
  const originalHits = findSearchHits(originalText, query, "original");
  return {
    nonRedactedHits: redactedHits.filter(
      (hit) => hit.context === "non-redacted",
    ),
    redactedOriginalHits: originalHits.filter(
      (hit) => hit.context === "redacted-original",
    ),
    redactionOnlyHits: redactedHits.filter(
      (hit) => hit.context === "redaction-only",
    ),
  };
}

function findSearchHits(
  model: PreviewSearchTextModel,
  query: string,
  source: "redacted" | "original",
): PreviewSearchHit[] {
  const hits: PreviewSearchHit[] = [];
  const { text, ranges } = model;
  for (const match of findQueryMatches(text, query)) {
    const { start, end } = match;
    const snippetStart = Math.max(0, start - 54);
    const snippetEnd = Math.min(text.length, end + 54);
    hits.push({
      id: `${source}-${hits.length}`,
      source,
      context: searchHitContext(source, ranges, start, end),
      before: text.slice(snippetStart, start),
      match: text.slice(start, end),
      after: text.slice(end, snippetEnd),
      leadingEllipsis: snippetStart > 0,
      trailingEllipsis: snippetEnd < text.length,
    });
  }
  return hits;
}

function findQueryMatches(
  text: string,
  query: string,
): Array<{ start: number; end: number }> {
  const matches: Array<{ start: number; end: number }> = [];
  if (!query) return matches;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let position = 0;
  while (position < text.length) {
    const start = lowerText.indexOf(lowerQuery, position);
    if (start === -1) break;
    const end = start + query.length;
    matches.push({ start, end });
    position = end;
  }
  return matches;
}

function previewSearchTextModel(
  reviewDoc: NonNullable<ReturnType<typeof selectedReviewDoc>>,
  source: "redacted" | "original",
): PreviewSearchTextModel {
  let text = "";
  const ranges: PreviewSearchTextRange[] = [];
  for (const segment of reviewDoc.segments) {
    const segmentText =
      source === "original"
        ? (segment.value ?? segment.text)
        : (segment.replacement ?? segment.text);
    const start = text.length;
    text += segmentText;
    ranges.push({
      start,
      end: text.length,
      redactedSegment: Boolean(segment.entryId),
    });
  }
  return { text, ranges };
}

function searchHitContext(
  source: "redacted" | "original",
  ranges: PreviewSearchTextRange[],
  start: number,
  end: number,
): PreviewSearchHit["context"] {
  const overlapsRedactedSegment = ranges.some(
    (range) => range.redactedSegment && start < range.end && end > range.start,
  );
  if (!overlapsRedactedSegment) return "non-redacted";
  return source === "original" ? "redacted-original" : "redaction-only";
}

function jumpToSearchHit(id: string): void {
  const source = id.startsWith("original-") ? "original" : "redacted";
  if (source === "original" && !state.showOriginalPreview) {
    showOriginalPreview();
  } else if (source === "redacted" && state.showOriginalPreview) {
    hideOriginalPreview({ silent: true });
  }
  window.requestAnimationFrame(() => {
    const mark = previewBody.querySelector<HTMLElement>(
      `[data-search-result-id="${cssEscape(id)}"]`,
    );
    if (!mark) return;
    mark.scrollIntoView({ block: "center", behavior: "smooth" });
    mark.classList.add("flash");
    window.setTimeout(() => mark.classList.remove("flash"), 900);
  });
}

function showOriginalPreview(): void {
  if (!selectedReviewDoc()) return;
  if (originalPreviewTimer !== undefined) {
    window.clearTimeout(originalPreviewTimer);
  }
  state.showOriginalPreview = true;
  hidePopover();
  renderPreview();
  showToast("", {
    durationMs: 10000,
    progress: true,
    countdownText: (secondsLeft) =>
      `Showing original text for ${secondsLeft}s.`,
  });
  originalPreviewTimer = window.setTimeout(() => {
    hideOriginalPreview();
  }, 10000);
}

function hideOriginalPreview(options: { silent?: boolean } = {}): void {
  if (originalPreviewTimer !== undefined) {
    window.clearTimeout(originalPreviewTimer);
    originalPreviewTimer = undefined;
  }
  if (!state.showOriginalPreview) {
    renderPreview();
    return;
  }
  state.showOriginalPreview = false;
  renderPreview();
  if (!options.silent) showToast("Preview is redacted again.");
}

function renderLevelControl(): void {
  levelButtons.forEach((button) => {
    const selected = button.dataset.level === state.level;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  levelActiveDesc.textContent = LEVEL_DESCRIPTIONS[state.level];
}

/* --------------------- Preview interactions ------------------------ */

previewBody.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>(
    ".redacted",
  );
  if (target) openPopover(target.dataset.entryId!, target);
});

previewBody.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = (event.target as HTMLElement).closest<HTMLElement>(
    ".redacted",
  );
  if (!target) return;
  event.preventDefault();
  openPopover(target.dataset.entryId!, target);
});

previewBody.addEventListener("scroll", hidePopover, { passive: true });

/* ------------------------- Entry popover --------------------------- */

function openPopover(entryId: string, anchor: HTMLElement): void {
  const entry = state.entries.find((item) => item.id === entryId);
  if (!entry) return;
  state.selectedEntryId = entryId;
  const style = kindStyle(entry.kind);
  popoverOriginal.textContent = entry.value;
  popoverOriginal.style.setProperty("--strike-color", style.color);
  popoverReplacement.value = entry.replacement;
  popover.hidden = false;
  positionPopover(anchor);
  popoverReplacement.focus();
  popoverReplacement.select();
}

function positionPopover(anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  popover.style.visibility = "hidden";
  popover.style.left = "0px";
  popover.style.top = "0px";
  const popRect = popover.getBoundingClientRect();
  const width = popRect.width || 260;
  let left = rect.left + rect.width / 2 - width / 2;
  left = Math.max(
    8 + window.scrollX,
    Math.min(left, window.innerWidth - width - 8 + window.scrollX),
  );
  let top = rect.bottom + 8 + window.scrollY;
  // If it would overflow the bottom, place above the anchor.
  const viewportBottom = window.scrollY + window.innerHeight;
  if (top + popRect.height > viewportBottom - 8) {
    top = rect.top - popRect.height - 8 + window.scrollY;
  }
  popover.style.left = `${Math.max(8, left)}px`;
  popover.style.top = `${Math.max(8, top)}px`;
  popover.style.visibility = "";
}

function hidePopover(): void {
  if (popover.hidden) return;
  popover.hidden = true;
  state.selectedEntryId = null;
}

popoverReplacement.addEventListener("input", () => {
  if (!state.selectedEntryId) return;
  setEntryReplacement(state.selectedEntryId, popoverReplacement.value);
});

popoverDelete.addEventListener("click", () => {
  if (!state.selectedEntryId) return;
  deleteEntry(state.selectedEntryId);
});

popoverFind.addEventListener("click", () => {
  if (!state.selectedEntryId) return;
  const id = state.selectedEntryId;
  hidePopover();
  expandKindForEntry(id);
  renderReplacements();
  const input = replacementsBody.querySelector<HTMLInputElement>(
    `[data-replacement-input="${cssEscape(id)}"]`,
  );
  if (input) {
    const row = input.closest(".entry-row");
    row?.classList.add("flash");
    row?.scrollIntoView({ block: "center", behavior: "smooth" });
    input.focus();
    input.select();
    window.setTimeout(() => row?.classList.remove("flash"), 900);
  }
});

function expandKindForEntry(id: string): void {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  state.expandedKinds.add(entry.kind);
}

document.addEventListener("click", (event) => {
  if (popover.hidden) return;
  const target = event.target as HTMLElement;
  if (popover.contains(target)) return;
  if (target.closest(".redacted")) return;
  hidePopover();
  renderReplacements();
});

window.addEventListener("resize", () => {
  if (!popover.hidden) hidePopover();
});

/* ----------------------- Selection to redact ----------------------- */

document.addEventListener("selectionchange", () => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    hideRedactButton();
    return;
  }
  const text = selection.toString();
  const trimmed = text.trim();
  if (!trimmed) {
    hideRedactButton();
    return;
  }
  const range = selection.getRangeAt(0);
  if (!previewBody.contains(range.commonAncestorContainer)) {
    hideRedactButton();
    return;
  }
  // Ignore selections anchored inside an already-redacted span.
  if (range.commonAncestorContainer.parentElement?.closest(".redacted")) {
    hideRedactButton();
    return;
  }
  pendingRedactionText = trimmed;
  showRedactButton(range);
});

function showRedactButton(range: Range): void {
  const rect = range.getBoundingClientRect();
  redactSelectionBtn.hidden = false;
  const btnRect = redactSelectionBtn.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - btnRect.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - btnRect.width - 8));
  redactSelectionBtn.style.left = `${left + window.scrollX}px`;
  redactSelectionBtn.style.top = `${rect.top - btnRect.height - 8 + window.scrollY}px`;
}

function hideRedactButton(): void {
  redactSelectionBtn.hidden = true;
}

redactSelectionBtn.addEventListener("mousedown", (event) =>
  event.preventDefault(),
);
redactSelectionBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  const selection = window.getSelection();
  const text = pendingRedactionText || selection?.toString().trim() || "";
  pendingRedactionText = "";
  const result = text ? addManualEntry(text, "preview") : null;
  selection?.removeAllRanges();
  hideRedactButton();
  if (result) revealManualEntry(result.id);
});

function revealManualEntry(id: string): void {
  window.requestAnimationFrame(() => {
    const span = previewBody.querySelector<HTMLElement>(
      `[data-entry-id="${cssEscape(id)}"]`,
    );
    if (!span) {
      revealManualEntryControls(id);
      return;
    }
    span.scrollIntoView({ block: "center", behavior: "auto" });
    revealManualEntryControls(id);
  });
}

function revealManualEntryControls(id: string): void {
  state.expandedKinds.add("CUSTOM");
  renderReplacements();
  window.requestAnimationFrame(() => {
    flashReplacementRow(id);
    const span = previewBody.querySelector<HTMLElement>(
      `[data-entry-id="${cssEscape(id)}"]`,
    );
    if (span) openPopover(id, span);
  });
}

function flashReplacementRow(id: string): void {
  const row = replacementsBody.querySelector<HTMLElement>(
    `[data-jump-entry="${cssEscape(id)}"]`,
  );
  if (!row) return;
  row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  row.classList.add("flash");
  window.setTimeout(() => row.classList.remove("flash"), 900);
}

/* --------------- Preview ↔ list jump helpers ----------------------- */

function jumpToEntryInPreview(id: string): void {
  const span = previewBody.querySelector<HTMLElement>(
    `[data-entry-id="${cssEscape(id)}"]`,
  );
  if (span) {
    flashPreviewSpan(span);
    return;
  }

  const entry = state.entries.find((item) => item.id === id);
  const sourceDocument = entry?.sources
    .map((source) =>
      state.documents.find((document) => document.fileName === source),
    )
    .find((document): document is LoadedDocument => Boolean(document));

  if (!sourceDocument || sourceDocument.id === state.selectedDocumentId) return;

  selectDocument(sourceDocument.id);
  window.requestAnimationFrame(() => {
    const nextSpan = previewBody.querySelector<HTMLElement>(
      `[data-entry-id="${cssEscape(id)}"]`,
    );
    if (nextSpan) flashPreviewSpan(nextSpan);
  });
}

function flashPreviewSpan(span: HTMLElement): void {
  span.scrollIntoView({ block: "center", behavior: "smooth" });
  span.classList.add("flash");
  window.setTimeout(() => span.classList.remove("flash"), 900);
}

/* ------------------------------ Helpers ---------------------------- */

function setBusy(busy: boolean, message?: string): void {
  state.busy = busy;
  if (message) setStatus(message);
  document.body.classList.toggle("busy", busy);
}

function setStatus(message: string): void {
  showToast(message);
}

function showToast(
  message: string,
  options: {
    durationMs?: number;
    progress?: boolean;
    countdownText?: (secondsLeft: number) => string;
  } = {},
): void {
  const durationMs = options.durationMs ?? 2600;
  const startedAt = Date.now();
  const endsAt = startedAt + durationMs;
  const formatCountdownText = (): string => {
    const secondsLeft = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    return options.countdownText?.(secondsLeft) ?? message;
  };
  const initialMessage = formatCountdownText();
  if (!initialMessage.trim()) return;
  const toast = document.createElement("div");
  toast.className = "toast-bubble";
  if (options.progress) {
    toast.classList.add("toast-bubble-timed");
    toast.style.setProperty("--toast-duration", `${durationMs}ms`);
  }
  const text = document.createElement("span");
  text.textContent = initialMessage;
  toast.appendChild(text);
  const countdownInterval = options.countdownText
    ? window.setInterval(() => {
        text.textContent = formatCountdownText();
      }, 250)
    : undefined;
  if (options.progress) {
    const progress = document.createElement("span");
    progress.className = "toast-progress";
    progress.setAttribute("aria-hidden", "true");
    toast.appendChild(progress);
  }
  toastRegion.appendChild(toast);
  window.setTimeout(() => {
    if (countdownInterval !== undefined) {
      window.clearInterval(countdownInterval);
    }
    toast.classList.add("leaving");
    window.setTimeout(() => toast.remove(), 180);
  }, durationMs);
}

function isSupportedFile(file: File): boolean {
  return /\.(?:md|markdown|txt|docx|pdf)$/i.test(file.name);
}

function unsupportedFileMessage(files: File[]): string {
  if (files.some((file) => /\.doc$/i.test(file.name))) {
    return "Old Word .doc files are not supported yet. Please save as .docx, .txt, or .pdf first.";
  }
  return files.length > 0 ? "Those file types are not supported." : "";
}

function sanitizedFilename(name: string): string {
  return `${name.replace(/\.[^.]+$/, "")}.redacted.md`;
}

function pluralize(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function formatHits(count: number): string {
  return `${count} ${count === 1 ? "hit" : "hits"}`;
}

function formatMatches(count: number): string {
  return `${count} ${count === 1 ? "match" : "matches"}`;
}

function formatMoreMatches(count: number): string {
  return `${count} more ${count === 1 ? "match" : "matches"}`;
}

function hasHave(count: number): string {
  return count === 1 ? "has" : "have";
}

function isAre(count: number): string {
  return count === 1 ? "is" : "are";
}

function remainsRemain(count: number): string {
  return count === 1 ? "remains" : "remain";
}

function allMatchesSubject(count: number): string {
  return count === 1 ? "The 1 match" : `All ${count} matches`;
}

function warningText(value: string): string {
  return `<span class="preview-search-warning-word">${escapeHtml(value)}</span>`;
}

function nonRedactedStatus(count: number, allMatches: boolean): string {
  if (allMatches) {
    return `${allMatchesSubject(count)} ${isAre(count)} ${warningText("non-redacted")}.`;
  }
  return `${formatMatches(count)} ${remainsRemain(count)} ${warningText("non-redacted")}.`;
}

function redactedOriginalStatus(count: number, allMatches: boolean): string {
  if (allMatches) {
    return `${allMatchesSubject(count)} in original ${hasHave(count)} been redacted.`;
  }
  return `${formatMatches(count)} in original ${hasHave(count)} been redacted.`;
}

function redactionsOnlyStatus(count: number): string {
  return `${formatMatches(count)} in redactions only.`;
}

function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

/** Minimal CSS escape for attribute selectors / data attribute values. */
function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

function matchesQuery(entry: ReplacementEntry, query: string): boolean {
  if (!query) return true;
  if (entry.value.toLowerCase().includes(query)) return true;
  if (entry.replacement.toLowerCase().includes(query)) return true;
  if (entry.kind.toLowerCase().includes(query)) return true;
  if (entry.reason.toLowerCase().includes(query)) return true;
  if (kindLabel(entry.kind).toLowerCase().includes(query)) return true;
  return entry.sources.some((source) => source.toLowerCase().includes(query));
}

function groupByKind(
  entries: ReplacementEntry[],
): Record<string, ReplacementEntry[]> {
  const groups: Record<string, ReplacementEntry[]> = {};
  for (const entry of entries) {
    (groups[entry.kind] ??= []).push(entry);
  }
  return groups;
}

const KIND_ORDER: CandidateKind[] = [
  "CUSTOM",
  "PERSON",
  "PERSON_OR_ORG",
  "ORG",
  "ADDRESS",
  "POSTCODE",
  "EMAIL",
  "PHONE",
  "URL",
  "INTERNAL_LINK",
  "DATE",
  "AMOUNT",
  "CASE_REF",
  "BUNDLE_REF",
  "EXHIBIT_REF",
  "TRANSCRIPT_REF",
  "PROCEDURAL_REF",
  "NATIONAL_ID",
  "BANK_ACCOUNT",
  "BUSINESS_ID",
  "LOCATION",
  "BRAND",
  "CHANNEL",
  "PROJECT",
  "PROJECT_OR_ISSUE",
  "DOCUMENT",
  "NON_LATIN_TEXT",
  "PROPER_NOUN",
];

function sortKinds(a: string, b: string): number {
  const ia = KIND_ORDER.indexOf(a as CandidateKind);
  const ib = KIND_ORDER.indexOf(b as CandidateKind);
  const oa = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
  const ob = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
  if (oa !== ob) return oa - ob;
  return a.localeCompare(b);
}

const KIND_LABELS: Record<string, string> = {
  CUSTOM: "Manual / Custom",
  PERSON: "Person",
  PERSON_OR_ORG: "Person or Org",
  ORG: "Organization",
  ADDRESS: "Address",
  POSTCODE: "Postcode",
  EMAIL: "Email",
  PHONE: "Phone",
  URL: "URL",
  INTERNAL_LINK: "Internal link",
  DATE: "Date",
  AMOUNT: "Amount",
  CASE_REF: "Case reference",
  BUNDLE_REF: "Bundle reference",
  EXHIBIT_REF: "Exhibit reference",
  TRANSCRIPT_REF: "Transcript reference",
  PROCEDURAL_REF: "Procedural reference",
  NATIONAL_ID: "National ID",
  BANK_ACCOUNT: "Bank account",
  BUSINESS_ID: "Business ID",
  LOCATION: "Location",
  BRAND: "Brand",
  CHANNEL: "Channel",
  PROJECT: "Project",
  PROJECT_OR_ISSUE: "Project / Issue",
  DOCUMENT: "Document",
  NON_LATIN_TEXT: "Non-Latin text",
  PROPER_NOUN: "Proper noun",
};

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? prettify(kind);
}

function prettify(kind: string): string {
  return kind
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

interface KindStyle {
  /** Inline CSS for small color dots. */
  dotCss: string;
  /** Inline CSS for category labels. */
  labelCss: string;
  /** Inline CSS for struck original values. */
  strikeCss: string;
  /** Inline CSS for redacted preview spans. */
  spanCss: string;
  /** Hex accent color. */
  color: string;
}

/** Consistent, accessible color per category, shared by the list and preview. */
const KIND_COLORS: Record<string, string> = {
  CUSTOM: "#a7342f",
  PERSON: "#245c96",
  PERSON_OR_ORG: "#5a4aa3",
  ORG: "#6a3f82",
  ADDRESS: "#7b5b21",
  POSTCODE: "#8a5b16",
  EMAIL: "#176c78",
  PHONE: "#287342",
  URL: "#52616f",
  INTERNAL_LINK: "#52616f",
  DATE: "#8a5b16",
  AMOUNT: "#9a4d14",
  CASE_REF: "#3f4f61",
  BUNDLE_REF: "#3f4f61",
  EXHIBIT_REF: "#3f4f61",
  TRANSCRIPT_REF: "#3f4f61",
  PROCEDURAL_REF: "#3f4f61",
  NATIONAL_ID: "#8f3159",
  BANK_ACCOUNT: "#8f3159",
  BUSINESS_ID: "#7b3d22",
  LOCATION: "#24724f",
  BRAND: "#9b3c69",
  CHANNEL: "#1f6f65",
  PROJECT: "#24724f",
  PROJECT_OR_ISSUE: "#245c96",
  DOCUMENT: "#52616f",
  NON_LATIN_TEXT: "#5f4592",
  PROPER_NOUN: "#5f6975",
};

function kindStyle(kind: string): KindStyle {
  const color = KIND_COLORS[kind] ?? "#5f6975";
  return {
    color,
    dotCss: `background:${color};`,
    labelCss: `background:${hexToRgba(color, 0.12)};color:${color};`,
    strikeCss: `text-decoration-color:${color};text-decoration-thickness:2px;`,
    spanCss: `color:${color};background:${hexToRgba(color, 0.1)};border-bottom:2px solid ${hexToRgba(color, 0.45)};`,
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ----------------------------- Dev mode ---------------------------- */

/** Fetch the synthetic sample and load it as a document. */
async function loadSampleDocument(replace: boolean): Promise<void> {
  setBusy(true, "Loading dev sample…");
  try {
    const response = await fetch(DEV_SAMPLE_PATH);
    const loadedFromFile = response.ok;
    const text = loadedFromFile ? await response.text() : EMBEDDED_DEV_SAMPLE;
    if (replace) {
      state.documents = [];
      state.selectedDocumentId = null;
      state.entries = [];
      state.removedEntryIds.clear();
    }
    state.documents.push({
      id: nextDocId(),
      fileName: loadedFromFile
        ? (DEV_SAMPLE_PATH.split("/").pop() ?? "dev-sample.md")
        : "embedded-dev-sample.md",
      text,
      warnings: [],
    });
    ensureSelectedDocument();
    recompute();
    renderAll();
    setStatus(
      loadedFromFile
        ? "Loaded synthetic dev sample."
        : "Loaded embedded synthetic dev sample.",
    );
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Could not load dev sample.",
    );
  } finally {
    setBusy(false);
  }
}

function updateDevFab(fab: HTMLButtonElement): void {
  if (state.devModeActive) {
    fab.classList.remove("off");
    fab.setAttribute("aria-label", "Turn off dev mode");
    fab.title = "Dev mode is ON. Click to turn off.";
    fab.innerHTML =
      '<i class="ph ph-flask" aria-hidden="true"></i><span>DEV: ON</span>';
  } else {
    fab.classList.add("off");
    fab.setAttribute("aria-label", "Turn on dev mode");
    fab.title = "Dev mode is OFF. Click to turn on and reload sample.";
    fab.innerHTML =
      '<i class="ph ph-flask" aria-hidden="true"></i><span>DEV: OFF</span>';
  }
}

function unloadSampleDocument(): void {
  const sampleFileName = DEV_SAMPLE_PATH.split("/").pop() ?? "dev-sample.md";
  const embeddedFileName = "embedded-dev-sample.md";
  const initialLength = state.documents.length;
  state.documents = state.documents.filter(
    (doc) =>
      doc.fileName !== sampleFileName && doc.fileName !== embeddedFileName,
  );
  if (state.documents.length !== initialLength) {
    const selectedDocExists = state.documents.some(
      (d) => d.id === state.selectedDocumentId,
    );
    if (!selectedDocExists) {
      state.selectedDocumentId =
        state.documents.length > 0 ? state.documents[0].id : null;
    }
    recompute();
    renderAll();
    setStatus("Unloaded synthetic dev sample.");
  }
}

/** Mount the bottom-left FAB that reloads the sample. */
function installDevFab(): void {
  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "dev-fab";
  updateDevFab(fab);
  fab.addEventListener("click", () => {
    if (state.devModeActive) {
      state.devModeActive = false;
      updateDevFab(fab);
      unloadSampleDocument();
    } else {
      state.devModeActive = true;
      updateDevFab(fab);
      void loadSampleDocument(true);
    }
  });
  document.body.appendChild(fab);
}

function initDevMode(): void {
  state.devModeActive = true;
  installDevFab();
  if (state.documents.length === 0) {
    void loadSampleDocument(false);
  }
}

/* ------------------------------ Boot ------------------------------- */

renderAll();
renderRoute();
if (DEV_MODE) initDevMode();
