type ValidationControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const FEEDBACK_ID = "naz-form-validation-feedback";
const STYLE_ID = "naz-form-validation-style";
const handledForms = new WeakSet<HTMLFormElement>();
let activeControl: ValidationControl | null = null;
let feedbackTimer = 0;

function isValidationControl(target: EventTarget | null): target is ValidationControl {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

function localizeDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

function cleanLabel(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[：:*]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fieldLabel(control: ValidationControl): string {
  const accessibleName = cleanLabel(control.getAttribute("aria-label"));
  if (accessibleName) return accessibleName;

  const wrapper = control.closest("label");
  const markedLabel = wrapper?.querySelector<HTMLElement>(
    ".field-label, .naz-floating-label, .auth-floating-label, .floating-label, [data-field-label]",
  );
  const visibleName = cleanLabel(markedLabel?.textContent);
  if (visibleName) return visibleName;

  const associatedName = cleanLabel(
    Array.from(control.labels ?? [])
      .map((label) => label.textContent ?? "")
      .join(" "),
  );
  if (associatedName) return associatedName;

  const placeholder = cleanLabel(control.getAttribute("placeholder"));
  if (placeholder) return placeholder;

  const name = (control.getAttribute("name") ?? "").toLowerCase();
  if (/phone|mobile|tel/.test(name)) return "شماره موبایل";
  if (/pass|password/.test(name)) return "رمز عبور";
  if (/email/.test(name)) return "ایمیل";
  if (/national|melli/.test(name)) return "کد ملی";
  if (/address/.test(name)) return "نشانی";
  if (/name/.test(name)) return "نام";
  return "این فیلد";
}

function validationMessage(control: ValidationControl): string {
  const validity = control.validity;
  const label = fieldLabel(control);
  const inputType = control instanceof HTMLInputElement ? control.type : "";
  const isSelect = control instanceof HTMLSelectElement;
  const isChoice = inputType === "checkbox" || inputType === "radio";
  const isFile = inputType === "file";

  if (validity.valueMissing) {
    if (isChoice) return `برای ادامه، ${label} را انتخاب کنید.`;
    if (isSelect || isFile) return `${label} را انتخاب کنید.`;
    return `${label} را وارد کنید.`;
  }
  if (validity.typeMismatch) {
    if (inputType === "email") return "ایمیل را با قالب معتبر وارد کنید.";
    if (inputType === "url") return "نشانی وب را با قالب معتبر وارد کنید.";
    return `قالب ${label} معتبر نیست.`;
  }
  if (validity.patternMismatch) {
    if (/موبایل|تلفن|تماس|phone|mobile|tel/i.test(label)) {
      return "شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.";
    }
    if (/کد ملی|شناسه ملی|national/i.test(label)) {
      return "کد ملی باید ۱۰ رقم باشد.";
    }
    if (/کد پستی|postal/i.test(label)) {
      return "کد پستی را با ۱۰ رقم وارد کنید.";
    }
    if (/شبا|iban/i.test(label)) {
      return "شماره شبا باید با IR و ۲۴ رقم وارد شود.";
    }
    if (/کد تحویل|تحویل مشتری/i.test(label)) {
      return "کد تحویل باید دقیقاً ۶ رقم باشد.";
    }
    return `قالب ${label} را بررسی کنید.`;
  }
  if (validity.tooShort) {
    const minLength = control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement
      ? control.minLength
      : -1;
    if (/رمز|password/i.test(label) && minLength > 0) {
      return `رمز عبور باید دست‌کم ${localizeDigits(minLength)} نویسه باشد.`;
    }
    return `${label} باید دست‌کم ${localizeDigits(Math.max(0, minLength))} نویسه باشد.`;
  }
  if (validity.tooLong) {
    const maxLength = control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement
      ? control.maxLength
      : -1;
    return `${label} نباید بیشتر از ${localizeDigits(Math.max(0, maxLength))} نویسه باشد.`;
  }
  if (validity.rangeUnderflow && control instanceof HTMLInputElement) {
    return `${label} نباید کمتر از ${localizeDigits(control.min)} باشد.`;
  }
  if (validity.rangeOverflow && control instanceof HTMLInputElement) {
    return `${label} نباید بیشتر از ${localizeDigits(control.max)} باشد.`;
  }
  if (validity.stepMismatch) return `مقدار ${label} را بررسی کنید.`;
  if (validity.badInput) return `مقدار ${label} را به شکل درست وارد کنید.`;
  if (validity.customError) return `مقدار ${label} را بررسی کنید.`;
  return `مقدار ${label} را بررسی کنید.`;
}

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .naz-floating-field {
      position: relative;
      display: block;
      padding-top: var(--naz-field-top, 7px);
    }
    .naz-floating-label {
      position: absolute;
      z-index: 2;
      top: var(--naz-field-center, 31px);
      right: 12px;
      max-width: calc(100% - 24px);
      overflow: hidden;
      padding: 0 5px;
      border-radius: 5px;
      background: #fff;
      color: #77857c;
      font: 600 11px/1.35 "Vazirmatn", "Vazirmatn Variable", Tahoma, sans-serif;
      text-overflow: ellipsis;
      white-space: nowrap;
      transform: translateY(-50%);
      pointer-events: none;
      transition: top .16s ease, color .16s ease, font-size .16s ease;
    }
    .naz-floating-field:focus-within > .naz-floating-label,
    .naz-floating-field:has(input:not(:placeholder-shown)) > .naz-floating-label,
    .naz-floating-field:has(textarea:not(:placeholder-shown)) > .naz-floating-label,
    .naz-floating-field:has(select) > .naz-floating-label,
    .naz-floating-field:has(input[type="file"]) > .naz-floating-label {
      top: var(--naz-field-top, 7px);
      color: #16865b;
      font-size: 9px;
    }
    .naz-floating-field input::placeholder,
    .naz-floating-field textarea::placeholder {
      color: transparent !important;
      opacity: 0;
      transition: opacity .16s ease, color .16s ease;
    }
    .naz-floating-field:focus-within input::placeholder,
    .naz-floating-field:focus-within textarea::placeholder {
      color: #94a198 !important;
      opacity: 1;
    }
    .naz-form-error {
      position: fixed;
      z-index: 2147483000;
      inset-inline: 16px;
      bottom: 18px;
      width: max-content;
      max-width: min(460px, calc(100vw - 32px));
      margin-inline: auto;
      padding: 11px 16px;
      border: 1px solid #efc8c4;
      border-right: 4px solid #b9463e;
      border-radius: 14px;
      background: #fff;
      color: #813a34;
      box-shadow: 0 10px 32px #26352e20;
      direction: rtl;
      text-align: right;
      font: 600 12px/1.9 "Vazirmatn", "Vazirmatn Variable", Tahoma, sans-serif;
      opacity: 0;
      visibility: hidden;
      transform: translateY(8px);
      transition: opacity .18s ease, transform .18s ease, visibility .18s;
      pointer-events: none;
    }
    .naz-form-error[data-visible="true"] {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
    input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"] {
      border-color: #bf5149 !important;
      box-shadow: 0 0 0 3px #bf51491c !important;
    }
    @media (max-width: 767px) {
      .naz-form-error { bottom: calc(78px + env(safe-area-inset-bottom)); }
    }
  `;
  document.head.appendChild(style);
}

function feedbackElement(): HTMLDivElement {
  let feedback = document.getElementById(FEEDBACK_ID) as HTMLDivElement | null;
  if (!feedback) {
    ensureStyles();
    feedback = document.createElement("div");
    feedback.id = FEEDBACK_ID;
    feedback.className = "naz-form-error";
    feedback.setAttribute("role", "alert");
    feedback.setAttribute("aria-live", "assertive");
    feedback.setAttribute("aria-atomic", "true");
    feedback.dataset.visible = "false";
    document.body.appendChild(feedback);
  }
  return feedback;
}

function hideFeedback(): void {
  if (feedbackTimer) window.clearTimeout(feedbackTimer);
  const feedback = document.getElementById(FEEDBACK_ID);
  if (feedback) {
    feedback.dataset.visible = "false";
    feedback.textContent = "";
  }
  activeControl = null;
}

function showFeedback(message: string, control: ValidationControl): void {
  const feedback = feedbackElement();
  feedback.textContent = message;
  feedback.dataset.visible = "true";
  activeControl = control;
  if (feedbackTimer) window.clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(hideFeedback, 6000);
}

function markFormHandled(form: HTMLFormElement | null): boolean {
  if (!form) return true;
  if (handledForms.has(form)) return false;
  handledForms.add(form);
  window.setTimeout(() => handledForms.delete(form), 0);
  return true;
}

function reportInvalid(control: ValidationControl, form: HTMLFormElement | null): void {
  control.setAttribute("aria-invalid", "true");
  if (!markFormHandled(form)) return;
  control.focus({ preventScroll: true });
  control.scrollIntoView({ block: "center", behavior: "smooth" });
  showFeedback(validationMessage(control), control);
}

ensureStyles();

document.addEventListener(
  "invalid",
  (event) => {
    const control = event.target;
    if (!isValidationControl(control)) return;
    event.preventDefault();
    reportInvalid(control, control.form);
  },
  true,
);

document.addEventListener(
  "submit",
  (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.noValidate) return;
    const invalidControl = Array.from(form.elements).find(
      (element): element is ValidationControl =>
        isValidationControl(element) && element.willValidate && !element.validity.valid,
    );
    if (!invalidControl) return;
    event.preventDefault();
    event.stopPropagation();
    reportInvalid(invalidControl, form);
  },
  true,
);

function clearControlError(target: EventTarget | null): void {
  if (!isValidationControl(target)) return;
  if (target.getAttribute("aria-invalid") === "true") {
    target.removeAttribute("aria-invalid");
  }
  if (activeControl === target) hideFeedback();
}

document.addEventListener("input", (event) => clearControlError(event.target), true);
document.addEventListener("change", (event) => clearControlError(event.target), true);
document.addEventListener(
  "reset",
  (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    window.setTimeout(() => {
      form.querySelectorAll<ValidationControl>("input, select, textarea").forEach((control) => {
        control.removeAttribute("aria-invalid");
      });
      hideFeedback();
    }, 0);
  },
  true,
);

export {};
