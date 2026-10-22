// Editing views. Every edit is held in the form until the user saves explicitly.

import {
  HOUSE_FIELDS,
  MIN_DOWN_PAYMENT_PERCENT,
  MULTI,
  NO,
  NUMBER,
  PROJECT_AREAS,
  PROJECT_NEED,
  PROJECT_STATES,
  PROJECT_WANT,
  SELECT,
  STATUSES,
  STATUS_AVAILABLE,
  TARGET_PAIRS,
  TEXT,
  TRI,
  YES,
  addPriceEntry,
  backupFileName,
  canDeletePriceEntry,
  createHouse,
  createId,
  createPoi,
  defaultStatusDate,
  deleteHouse,
  deletePriceEntry,
  isFieldApplicable,
  isMlsNumber,
  mlsNumberError,
  normalizeHouse,
  normalizeSettings,
  parseData,
  parseNumberInput,
  parseProjectFieldName,
  projectFieldName,
  renameLadderHidden,
  saveHouse,
  projectsProgress,
  sectionProgress,
  serializeData,
  setListingDate,
  setProject,
  setStatus,
  toggleNone,
  toggleOption,
  updatePriceEntry,
  validateHouse,
  validateListingDate,
  validateNewHouse,
  validatePoi,
  validatePriceEntry,
  validateSettings,
  validateStatus,
} from './data.js';
import {
  HOUSE_SECTIONS,
  OPTION_LABELS,
  PROJECT_LABELS,
  PROJECT_STATE_LABELS,
  SECTION_ORDERS,
  STATUS_DATE_LABELS,
  STATUS_LABELS,
  countText,
  el,
  findSection,
  formatDate,
  formatMoney,
  formatNumber,
  isOnMap,
  knownCountText,
  pageTitle,
  progressLevel,
  sectionNav,
} from './render.js';

const TARGET_HINT = 'Both values are needed before this is scored.';

// Settings form layout. Each field is { name, label, prefix?, suffix?, hint? }.
const FINANCING_GROUPS = [
  {
    title: 'Loan',
    fields: [
      { name: 'interestRate', label: 'Interest rate', suffix: '%', hint: 'Monthly costs cannot be calculated until this is set.' },
      { name: 'pointsPercent', label: 'Points', suffix: '%', hint: 'Cash to close cannot be calculated until this is set.' },
      { name: 'loanTermYears', label: 'Loan term', suffix: 'years' },
      { name: 'downPaymentPercent', label: 'Default down payment', suffix: '%', hint: `${MIN_DOWN_PAYMENT_PERCENT}% minimum.` },
      { name: 'plannedRecastPrincipal', label: 'Planned recast principal', prefix: '$' },
    ],
  },
  {
    title: 'Lender estimates',
    fields: [
      { name: 'fixedLenderFee', label: 'Fixed lender fee', prefix: '$' },
      { name: 'titleInsurance', label: `Lender's title insurance`, prefix: '$' },
      { name: 'prepaidInterestDays', label: 'Prepaid-interest days', suffix: 'days' },
    ],
  },
  {
    title: 'Tax and insurance estimates',
    fields: [
      { name: 'fallbackPropertyTaxRate', label: 'Property tax estimate', suffix: '% of price per year', hint: 'Used when a house has no tax entered.' },
      { name: 'fallbackAnnualInsurance', label: 'Homeowners insurance estimate', prefix: '$', suffix: 'per year', hint: 'Used when a house has no insurance entered.' },
      { name: 'prepaidInsuranceMonths', label: 'Insurance prepaid at closing', suffix: 'months' },
      { name: 'insuranceReserveMonths', label: 'Insurance escrow reserve', suffix: 'months' },
      { name: 'propertyTaxReserveMonths', label: 'Property tax escrow reserve', suffix: 'months' },
    ],
  },
  {
    title: 'Third-party and government fees',
    collapsed: true,
    fields: [
      { name: 'appraisalFee', label: 'Appraisal', prefix: '$' },
      { name: 'creditReportFee', label: 'Credit report', prefix: '$' },
      { name: 'floodCertificateFee', label: 'Flood certificate', prefix: '$' },
      { name: 'mersFee', label: 'MERS registration', prefix: '$' },
      { name: 'processingFee', label: 'Third-party processing', prefix: '$' },
      { name: 'taxMonitoringFee', label: 'Tax monitoring', prefix: '$' },
      { name: 'escrowClosingFee', label: 'Escrow / closing', prefix: '$' },
      { name: 'recordingFee', label: 'Mortgage recording', prefix: '$' },
      { name: 'otherGovernmentFees', label: 'Other government fees', prefix: '$' },
    ],
  },
];

const TARGET_GROUPS = [
  {
    title: 'Monthly housing cost',
    fields: [
      { name: 'comfortableMonthlyCost', label: 'Comfortable', prefix: '$', suffix: 'per month', hint: TARGET_HINT },
      { name: 'maximumMonthlyCost', label: 'Maximum', prefix: '$', suffix: 'per month' },
    ],
  },
  {
    title: 'Cash to close',
    fields: [
      {
        name: 'comfortableCashToClose',
        label: 'Comfortable',
        prefix: '$',
        hint: `Cash due at closing only; required work has its own budget below. ${TARGET_HINT}`,
      },
      { name: 'maximumCashToClose', label: 'Maximum', prefix: '$' },
    ],
  },
  {
    title: 'Required work',
    fields: [
      {
        name: 'maximumPurchasePrice',
        label: 'Maximum purchase price',
        prefix: '$',
        hint: 'Every dollar a house is listed below this is room for required repairs. Required work is not scored until this is set.',
      },
    ],
  },
];

/* --------------------------------------------------------------------------
   Shared field building
   -------------------------------------------------------------------------- */

/**
 * Wraps a typed input in its field: a label holding the question and control, then the hint and error.
 * @param {{ name: string, label: string, hint?: string }} field - Field layout.
 * @param {HTMLElement} input - The input or textarea.
 * @param {Array<HTMLElement|null>} control - The input with any units beside it.
 * @param {boolean} wide - Whether the field spans the full row.
 * @returns {{ node: HTMLElement, input: HTMLElement, error: HTMLElement }} The field and its live parts.
 */
function typedField(field, input, control, wide) {
  // Only the question and units name the input; the hint and error describe it.
  const error = el('span', { class: 'error', id: `error-${field.name}` });
  const hint = field.hint ? el('span', { class: 'hint', id: `hint-${field.name}` }, [field.hint]) : null;
  input.setAttribute('aria-describedby', hint === null ? error.id : `${hint.id} ${error.id}`);
  const node = el('div', { class: wide ? 'field wide' : 'field', 'data-field': field.name }, [
    el('label', {}, [el('span', { class: 'label' }, [field.label]), el('span', { class: 'control' }, control)]),
    hint,
    error,
  ]);
  return { node, input, error };
}

/**
 * Builds a labeled number input with its unit, hint, and error line.
 * @param {{ name: string, label: string, prefix?: string, suffix?: string, hint?: string, plain?: boolean, coordinate?: boolean, wide?: boolean }} field - Field layout.
 * @param {number|null} value - Current value; null shows as blank.
 * @param {string|null} [placeholder] - Text shown while the field is blank.
 * @returns {{ node: HTMLElement, input: HTMLInputElement, error: HTMLElement }} The field and its live parts.
 */
function numberField(field, value, placeholder = null) {
  let shown = '';
  // Plain numbers, such as years, are never given thousands separators; coordinates are never rounded.
  if (value !== null) shown = field.plain || field.coordinate ? String(value) : formatNumber(value);
  // A phone's number pads have no minus sign, so coordinates get the full keyboard; that also keeps formatOnLeave off them.
  let inputmode = field.plain ? 'numeric' : 'decimal';
  if (field.coordinate) inputmode = 'text';
  const input = el('input', {
    type: 'text',
    inputmode,
    autocomplete: 'off',
    name: field.name,
    value: shown,
    placeholder,
    // Marks a coordinate as a number for styling, since its inputmode no longer says so.
    'data-coordinate': field.coordinate ? '' : null,
  });
  const control = [
    field.prefix ? el('span', { class: 'unit' }, [field.prefix]) : null,
    input,
    field.suffix ? el('span', { class: 'unit' }, [field.suffix]) : null,
  ];
  return typedField(field, input, control, field.wide === true);
}

/**
 * Builds a labeled text, date, or multi-line input with its hint and error line.
 * @param {{ name: string, label: string, hint?: string, multiline?: boolean, type?: string, wide?: boolean }} field - Field layout.
 * @param {string} value - Current text.
 * @returns {{ node: HTMLElement, input: HTMLElement, error: HTMLElement }} The field and its live parts.
 */
function textField(field, value) {
  const attrs = { name: field.name, autocomplete: 'off' };
  let input;
  if (field.multiline) {
    input = el('textarea', { ...attrs, rows: '2' }, [value]);
  } else {
    input = el('input', { ...attrs, type: field.type || 'text', value });
  }
  // Text fields span the full row unless they opt out.
  return typedField(field, input, [input], field.wide !== false);
}

/**
 * Reformats a number field when the user leaves it, leaving unreadable text untouched.
 * @param {FocusEvent} event - Focus-out event from inside a form.
 */
function formatOnLeave(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.inputMode !== 'decimal') return;
  const parsed = parseNumberInput(input.value);
  if (parsed.valid && parsed.value !== null) input.value = formatNumber(parsed.value);
}

/**
 * Builds the MLS number field: digits typed as text, never formatted, since the number is the house's id.
 * @param {string} value - Current MLS number, or blank.
 * @param {string} [hint] - Text shown under the field.
 * @returns {{ node: HTMLElement, input: HTMLInputElement, error: HTMLElement }} The field and its live parts.
 */
function mlsNumberField(value, hint) {
  const field = textField({ name: 'mlsNumber', label: 'MLS number', hint, wide: false }, value);
  // Numeric rather than decimal, so formatOnLeave never adds thousands separators.
  field.input.setAttribute('inputmode', 'numeric');
  return field;
}

/* --------------------------------------------------------------------------
   Settings
   -------------------------------------------------------------------------- */

/**
 * Builds one group of settings fields, registering each field's live parts.
 * @param {{ title: string, collapsed?: boolean, fields: object[] }} group - Group layout.
 * @param {Object<string, number|null>} settings - Current saved settings.
 * @param {Object<string, { input: HTMLInputElement, error: HTMLElement }>} parts - Registry filled by field name.
 * @returns {HTMLElement} A fieldset, or a details element for collapsed groups.
 */
function settingsGroup(group, settings, parts) {
  const fields = [];
  for (const field of group.fields) {
    const value = settings[field.name];
    const built = numberField(field, value, value === null ? 'Not set' : null);
    parts[field.name] = { input: built.input, error: built.error };
    fields.push(built.node);
  }
  if (group.collapsed) {
    // A details element cannot be a grid itself, so its fields get their own wrapper.
    return el('details', { class: 'group' }, [el('summary', {}, [group.title]), el('div', { class: 'fields' }, fields)]);
  }
  return el('fieldset', { class: 'group' }, [el('legend', {}, [group.title]), ...fields]);
}

/**
 * Builds one column of the Settings form.
 * @param {string} title - Column heading.
 * @param {string} intro - One-line explanation under the heading.
 * @param {object[]} groups - Group layouts for the column.
 * @param {Object<string, number|null>} settings - Current saved settings.
 * @param {Object<string, { input: HTMLInputElement, error: HTMLElement }>} parts - Registry filled by field name.
 * @returns {HTMLElement} A card containing the groups.
 */
function settingsColumn(title, intro, groups, settings, parts) {
  const card = el('section', { class: 'card' }, [el('h2', {}, [title]), el('p', { class: 'muted' }, [intro])]);
  for (const group of groups) card.append(settingsGroup(group, settings, parts));
  return card;
}

/**
 * Downloads all app data as a backup file.
 * @param {object} app - App context with the store, today's date, and announce.
 */
function exportBackup(app) {
  const blob = new Blob([serializeData(app.store.get())], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: backupFileName(app.today()) });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  app.announce('Backup downloaded.');
}

/**
 * Replaces all app data with a backup file after the user confirms.
 * @param {object} app - App context with the store, confirm, and announce.
 * @param {File} file - Backup file chosen by the user.
 * @returns {Promise<void>} Resolves when the import has finished or been declined.
 */
async function importBackup(app, file) {
  const result = parseData(await file.text());
  if (!result.ok) {
    app.announce(result.message);
    return;
  }
  const count = result.data.houses.length;
  const confirmed = await app.confirm({
    title: 'Replace everything with this backup?',
    text: `The backup holds ${countText(count, 'house', 'houses')}. Everything now on this device will be replaced.`,
    confirmLabel: 'Replace data',
    cancelLabel: 'Cancel',
  });
  if (!confirmed) return;
  const saved = app.store.update(result.data);
  app.announce(saved ? 'Backup imported.' : 'Backup loaded, but this browser could not store it.');
}

/**
 * Builds the Backup card with export and import controls.
 * @param {object} app - App context.
 * @returns {HTMLElement} The Backup card.
 */
function backupCard(app) {
  const fileInput = el('input', { type: 'file', accept: 'application/json,.json', hidden: '' });
  const exportButton = el('button', { class: 'button', type: 'button' }, ['Export backup']);
  const importButton = el('button', { class: 'button', type: 'button' }, ['Import backup']);

  /**
   * Starts an import when a file has been chosen, then clears the chooser.
   * @returns {Promise<void>} Resolves when the import has finished.
   */
  async function handleFileChosen() {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (file) await importBackup(app, file);
  }

  exportButton.addEventListener('click', function handleExport() {
    exportBackup(app);
  });
  importButton.addEventListener('click', function handleImport() {
    fileInput.click();
  });
  fileInput.addEventListener('change', handleFileChosen);

  return el('section', { class: 'card backup' }, [
    el('h2', {}, ['Backup']),
    el('p', { class: 'muted' }, [
      'Everything is stored only in this browser on this device. Export a backup to keep a copy or to move your houses to another device.',
    ]),
    el('div', { class: 'actions' }, [exportButton, importButton, fileInput]),
  ]);
}

/**
 * Builds the Map card: one row of fields per place shown on the Houses map, saved with the rest of Settings.
 * @param {Array<{ id: string, title: string, latitude: number, longitude: number }>} pois - Saved places.
 * @returns {{ node: HTMLElement, rows: Array<{ id: string, node: HTMLElement, parts: object }> }} The card, and its live rows in order.
 */
function mapCard(pois) {
  const rows = [];
  const list = el('div', { class: 'list' });
  const empty = el('p', { class: 'muted' }, ['No places yet.']);
  const add = el('button', { class: 'button', type: 'button' }, ['Add place']);

  // Rows are named by position, so removing one renumbers the rest.
  function renumber() {
    rows.forEach(function numberRow(row, index) {
      row.legend.textContent = `Place ${index + 1}`;
      row.remove.setAttribute('aria-label', `Remove place ${index + 1}`);
    });
    list.hidden = rows.length === 0;
    empty.hidden = rows.length > 0;
  }

  /**
   * Adds a row of fields for a saved place, or a blank row for a new one.
   * @param {{ id: string, title: string, latitude: number, longitude: number }|null} poi - Saved place, or null for a new one.
   * @returns {{ id: string, node: HTMLElement, parts: object }} The row.
   */
  function addRow(poi) {
    const id = poi === null ? createId() : poi.id;
    const title = textField({ name: `place-${id}-title`, label: 'Title' }, poi === null ? '' : poi.title);
    const latitude = numberField({ name: `place-${id}-latitude`, label: 'Latitude', coordinate: true }, poi === null ? null : poi.latitude);
    const longitude = numberField({ name: `place-${id}-longitude`, label: 'Longitude', coordinate: true }, poi === null ? null : poi.longitude);
    const legend = el('legend');
    const remove = el('button', { class: 'button danger', type: 'button' }, ['Remove']);
    // Kept, but not plotted: the map only covers the Salt Lake area.
    const outside = poi !== null && !isOnMap(poi.latitude, poi.longitude) ? el('p', { class: 'muted' }, ['Outside the map area']) : null;
    const node = el('fieldset', { class: 'group' }, [legend, el('div', { class: 'fields' }, [title.node, latitude.node, longitude.node]), outside, remove]);
    const row = { id, legend, remove, node, parts: { title, latitude, longitude } };
    remove.addEventListener('click', function removeRow() {
      rows.splice(rows.indexOf(row), 1);
      node.remove();
      renumber();
      add.focus();
    });
    rows.push(row);
    list.append(node);
    renumber();
    return row;
  }

  for (const poi of pois) addRow(poi);
  renumber();
  add.addEventListener('click', function addPlace() {
    addRow(null).parts.title.input.focus();
  });

  const node = el('section', { class: 'card places' }, [
    el('h2', {}, ['Map']),
    el('p', { class: 'muted' }, ['Places shown on the Houses map for reference. Latitude and longitude are decimal degrees, such as 40.7518 and -111.8160.']),
    empty,
    list,
    el('div', { class: 'actions' }, [add]),
  ]);
  return { node, rows };
}

/**
 * Builds the Settings view: financing assumptions, scoring targets, map places, and backup.
 * @param {object} app - App context with the store, leave guard, confirm, and announce.
 * @returns {HTMLElement} Root element of the view.
 */
export function renderSettings(app) {
  const settings = app.store.get().settings;
  const parts = {};

  const financing = settingsColumn(
    'Financing assumptions',
    'Applied to every house unless a house has its own value.',
    FINANCING_GROUPS,
    settings,
    parts,
  );
  const targets = settingsColumn('Scoring targets', 'What feels comfortable, and the most you would consider.', TARGET_GROUPS, settings, parts);
  const { node: places, rows: placeRows } = mapCard(app.store.get().pois);
  const form = el('form', { novalidate: '' }, [
    el('div', { class: 'columns' }, [financing, targets, places]),
    el('div', { class: 'actions' }, [el('button', { class: 'button primary', type: 'submit' }, ['Save settings'])]),
  ]);

  /**
   * Reads the form into settings values.
   * @returns {Object<string, number|null>} Value per setting; NaN where the text is not a number.
   */
  function readDraft() {
    const draft = {};
    for (const [name, part] of Object.entries(parts)) {
      const parsed = parseNumberInput(part.input.value);
      draft[name] = parsed.valid ? parsed.value : NaN;
    }
    return draft;
  }

  /**
   * Checks whether a place row has been left entirely blank, in which case it is not saved.
   * @param {{ parts: object }} row - Place row.
   * @returns {boolean} True when the title and both coordinates are empty.
   */
  function isBlankPlace(row) {
    return Object.values(row.parts).every((part) => part.input.value.trim() === '');
  }

  /**
   * Reads one place row.
   * @param {{ id: string, parts: object }} row - Place row.
   * @returns {{ id: string, title: string, latitude: number|null, longitude: number|null }} Its values; NaN where the text is not a number.
   */
  function readPlace(row) {
    const place = { id: row.id, title: row.parts.title.input.value };
    for (const name of ['latitude', 'longitude']) {
      const parsed = parseNumberInput(row.parts[name].input.value);
      place[name] = parsed.valid ? parsed.value : NaN;
    }
    return place;
  }

  /**
   * Checks one place row; a blank row has nothing wrong with it, since it is skipped.
   * @param {{ id: string, parts: object }} row - Place row.
   * @returns {Object<string, string>} Message per invalid part: title, latitude, or longitude.
   */
  function placeErrors(row) {
    return isBlankPlace(row) ? {} : validatePoi(readPlace(row)).errors;
  }

  /**
   * Captures the place rows as typed, for telling whether they have changed.
   * @returns {string} The rows' ids and text, leaving out blank rows.
   */
  function placesText() {
    const typed = [];
    for (const row of placeRows) {
      if (!isBlankPlace(row)) typed.push([row.id, ...Object.values(row.parts).map((part) => part.input.value)]);
    }
    return JSON.stringify(typed);
  }

  /**
   * Checks whether the form differs from the saved settings and places.
   * @returns {boolean} True when there are unsaved changes.
   */
  function isDirty() {
    const draft = readDraft();
    for (const name of Object.keys(parts)) {
      if (!Object.is(draft[name], baseline[name])) return true;
    }
    return placesText() !== baselinePlaces;
  }

  /**
   * Shows or clears the error under each of the named fields, leaving other fields as they are.
   * @param {Object<string, string>} errors - Message per invalid field name.
   * @param {string[]} names - Fields to update.
   * @param {Object<string, { input: HTMLInputElement, error: HTMLElement }>} [registry] - Where the fields are found: the settings, or one place row.
   * @returns {HTMLInputElement|null} The first invalid input among them, or null when all are valid.
   */
  function showErrors(errors, names, registry = parts) {
    let firstInvalid = null;
    for (const name of names) {
      const part = registry[name];
      const message = errors[name] || '';
      part.error.textContent = message;
      if (message === '') {
        part.input.removeAttribute('aria-invalid');
      } else {
        part.input.setAttribute('aria-invalid', 'true');
        if (firstInvalid === null) firstInvalid = part.input;
      }
    }
    return firstInvalid;
  }

  /**
   * Validates and saves the settings when the form is submitted.
   * @param {SubmitEvent} event - Submit event from the Settings form.
   */
  function handleSubmit(event) {
    event.preventDefault();
    const draft = readDraft();
    const result = validateSettings(draft);
    let firstInvalid = showErrors(result.errors, Object.keys(parts));
    for (const row of placeRows) {
      const invalid = showErrors(placeErrors(row), Object.keys(row.parts), row.parts);
      if (firstInvalid === null) firstInvalid = invalid;
    }
    if (firstInvalid !== null) {
      const collapsed = firstInvalid.closest('details');
      if (collapsed) collapsed.open = true;
      firstInvalid.focus();
      app.announce('Some settings need fixing before they can be saved.');
      return;
    }
    const data = app.store.get();
    const pois = [];
    for (const row of placeRows) {
      if (!isBlankPlace(row)) pois.push(createPoi(readPlace(row)));
    }
    const saved = app.store.update({ ...data, settings: normalizeSettings(draft), pois });
    app.announce(saved ? 'Settings saved.' : 'Settings changed, but this browser could not store them.');
  }

  /**
   * Validates a field as the user leaves it, along with its target partner if it has one.
   * @param {FocusEvent} event - Focus-out event from inside the Settings form.
   */
  function handleFieldLeave(event) {
    const name = event.target.name;
    const row = placeRows.find((placeRow) => placeRow.node.contains(event.target));
    if (row !== undefined) {
      const part = Object.keys(row.parts).find((key) => row.parts[key].input === event.target);
      if (part !== undefined) showErrors(placeErrors(row), [part], row.parts);
      return;
    }
    if (parts[name] === undefined) return;
    let names = [name];
    // Comfortable and Maximum are checked against each other, so refresh both.
    for (const pair of TARGET_PAIRS) {
      if (pair.includes(name)) names = pair;
    }
    showErrors(validateSettings(readDraft()).errors, names);
  }

  // Compare against the form as first shown, so display rounding never reads as an edit.
  const baseline = readDraft();
  const baselinePlaces = placesText();

  form.addEventListener('submit', handleSubmit);
  form.addEventListener('focusout', formatOnLeave);
  form.addEventListener('focusout', handleFieldLeave);
  app.setLeaveGuard(isDirty);

  const backup = backupCard(app);
  return el('section', { class: 'settings' }, [pageTitle('Settings'), sectionNav('Settings sections', [financing, targets, places, backup]), form, backup]);
}

/* --------------------------------------------------------------------------
   Property form layout
   -------------------------------------------------------------------------- */

const NONE_VALUE = '__none';
const UNKNOWN_VALUE = '__unknown';

// Phone widths, matching the breakpoint where primary navigation moves to the bottom of the screen.
const TOUR_ORDER_MEDIA = '(max-width: 599px)';

/* --------------------------------------------------------------------------
   Property form controls
   -------------------------------------------------------------------------- */

/**
 * Builds one pill of a choice control: a radio or checkbox with its visible label.
 * @param {string} type - "radio" or "checkbox".
 * @param {string} name - Field name shared by the control's inputs.
 * @param {string} value - Value this pill stands for.
 * @param {string} text - Visible label.
 * @param {boolean} checked - Whether the pill starts selected.
 * @param {string|null} [variant] - Extra class: "unknown" or "none".
 * @returns {HTMLElement} The pill's label element.
 */
function choicePill(type, name, value, text, checked, variant = null) {
  const input = el('input', { type, name, value, checked: checked ? '' : null });
  return el('label', { class: variant }, [input, el('span', {}, [text])]);
}

/**
 * Builds the fieldset every choice control shares: the question as its legend, the pills, then any hint.
 * @param {{ name: string, label: string, hint?: string }} field - Field layout; its name tags the fieldset.
 * @param {HTMLElement[]} pills - Pills from choicePill.
 * @param {boolean} [wide] - Whether the control spans the full row.
 * @returns {HTMLFieldSetElement} The fieldset, tagged with data-field.
 */
function choiceFieldset(field, pills, wide = false) {
  const hint = field.hint ? el('span', { class: 'hint', id: `hint-${field.name}` }, [field.hint]) : null;
  return el('fieldset', { class: wide ? 'field choice wide' : 'field choice', 'data-field': field.name, 'aria-describedby': hint === null ? null : hint.id }, [
    el('legend', { class: 'label' }, [field.label]),
    el('div', { class: 'options' }, pills),
    hint,
  ]);
}

/**
 * Builds a yes/no or single-select control whose unanswered state is an explicit Unknown pill.
 * @param {{ name: string, label: string, hint?: string }} field - Field layout.
 * @param {Array<[string, string]>} options - Each option's value and label, in order.
 * @param {string|null} value - Current answer; null when unknown.
 * @returns {HTMLElement} A fieldset holding the radio pills.
 */
function singleChoiceField(field, options, value) {
  const pills = [];
  for (const [optionValue, text] of options) {
    pills.push(choicePill('radio', field.name, optionValue, text, value === optionValue));
  }
  pills.push(choicePill('radio', field.name, '', 'Unknown', value === null, 'unknown'));
  return choiceFieldset(field, pills);
}

/**
 * Builds a multi-select control with an explicit None (or Unknown) pill.
 * @param {{ name: string, label: string, hint?: string, noneLabel?: string, unknownOption?: boolean }} field - Field layout.
 * @param {Array<[string, string]>} options - Each option's value and label, in order.
 * @param {string[]|null} value - Current selection; null when untouched, [] when answered None.
 * @returns {HTMLElement} A fieldset holding the checkbox pills.
 */
function multiChoiceField(field, options, value) {
  const pills = [];
  for (const [optionValue, text] of options) {
    pills.push(choicePill('checkbox', field.name, optionValue, text, value !== null && value.includes(optionValue)));
  }
  if (field.unknownOption) {
    pills.push(choicePill('checkbox', field.name, UNKNOWN_VALUE, 'Unknown', value === null, 'unknown'));
  } else {
    const isNone = value !== null && value.length === 0;
    pills.push(choicePill('checkbox', field.name, NONE_VALUE, field.noneLabel, isNone, 'none'));
  }
  return choiceFieldset(field, pills, true);
}

/**
 * Sets a multi-select's checkboxes to match a stored selection.
 * @param {HTMLFormElement} form - Form containing the control.
 * @param {string} name - Field name.
 * @param {string[]|null} value - Selection to show.
 */
function showMultiChoice(form, name, value) {
  for (const input of form.querySelectorAll(`input[name="${name}"]`)) {
    if (input.value === NONE_VALUE) input.checked = value !== null && value.length === 0;
    else if (input.value === UNKNOWN_VALUE) input.checked = value === null;
    else input.checked = value !== null && value.includes(input.value);
  }
}

/**
 * Words the placeholder for a blank field that falls back to a Settings value or estimate.
 * @param {{ inherits?: string, estimate?: string }} field - Field layout.
 * @param {object} settings - Current app settings.
 * @returns {string|null} Placeholder text, or null when the field has no fallback.
 */
function fallbackPlaceholder(field, settings) {
  if (field.estimate === 'tax') return `Estimated at ${settings.fallbackPropertyTaxRate}% of price`;
  if (field.estimate === 'insurance') return `Estimated at ${formatNumber(settings.fallbackAnnualInsurance)}`;
  if (field.inherits === undefined) return null;
  const inherited = settings[field.inherits];
  return inherited === null ? 'Not set in Settings' : `${formatNumber(inherited)} from Settings`;
}

const YES_NO_CHOICES = [[YES, 'Yes'], [NO, 'No']];

/**
 * Pairs a select or multi-select field's options with their labels, in the order the field defines.
 * @param {string} name - Field name from HOUSE_FIELDS.
 * @returns {Array<[string, string]>} Each option's value and label.
 */
function optionChoices(name) {
  const choices = [];
  for (const option of HOUSE_FIELDS[name].options) choices.push([option, OPTION_LABELS[name][option]]);
  return choices;
}

/**
 * Builds the control for one property field, chosen by the field's kind.
 * @param {object} field - Field layout from HOUSE_SECTIONS.
 * @param {object} house - House supplying the current value.
 * @param {object} settings - Current app settings, for fallback placeholders.
 * @returns {HTMLElement} The field's element, tagged with data-field.
 */
function houseField(field, house, settings) {
  const kind = HOUSE_FIELDS[field.name].kind;
  const value = house[field.name];
  if (kind === NUMBER) return numberField(field, value, fallbackPlaceholder(field, settings)).node;
  if (kind === TEXT) return textField(field, value).node;
  if (kind === TRI) return singleChoiceField(field, YES_NO_CHOICES, value);
  if (kind === SELECT) return singleChoiceField(field, optionChoices(field.name), value);
  return multiChoiceField(field, optionChoices(field.name), value);
}

/**
 * Lists the fields of a section that count toward its progress.
 * @param {{ fields: Array<{ name: string, counts?: boolean }> }} section - Section layout.
 * @returns {string[]} Names of the counted fields.
 */
function countedFields(section) {
  const names = [];
  for (const field of section.fields) {
    if (field.counts !== false) names.push(field.name);
  }
  return names;
}

/**
 * Shows or clears the error under one field.
 * @param {HTMLFormElement} form - Form containing the field.
 * @param {string} name - Field name.
 * @param {string} message - Error text, or an empty string to clear it.
 */
function showFieldError(form, name, message) {
  const input = form.elements[name];
  const error = form.querySelector(`#error-${name}`);
  if (!error || !(input instanceof HTMLElement)) return;
  error.textContent = message;
  if (message === '') input.removeAttribute('aria-invalid');
  else input.setAttribute('aria-invalid', 'true');
}

/**
 * Builds the controls for one project area: its state, and the note, cost, and excitement it may need.
 * @param {string} area - Project area key such as "kitchen".
 * @param {{ state: string|null, note: string, cost: number|null, excited: string|null }} project - Current values.
 * @returns {HTMLElement} A fieldset tagged with data-project.
 */
function projectField(area, project) {
  const statePills = [];
  for (const state of PROJECT_STATES) {
    statePills.push(choicePill('radio', projectFieldName(area, 'state'), state, PROJECT_STATE_LABELS[state], project.state === state));
  }
  const excitedName = projectFieldName(area, 'excited');
  const excitedPills = [];
  for (const [value, text] of YES_NO_CHOICES) {
    excitedPills.push(choicePill('radio', excitedName, value, text, project.excited === value));
  }
  const excited = choiceFieldset({ name: excitedName, label: 'Excited about it?' }, excitedPills);
  const note = textField({ name: projectFieldName(area, 'note'), label: 'What would change?' }, project.note).node;
  const cost = numberField({ name: projectFieldName(area, 'cost'), label: 'Estimated cost', prefix: '$' }, project.cost).node;
  note.dataset.part = 'note';
  cost.dataset.part = 'cost';
  excited.dataset.part = 'excited';
  return el('fieldset', { class: 'field choice project', 'data-project': area }, [
    el('legend', { class: 'label' }, [PROJECT_LABELS[area]]),
    el('div', { class: 'options' }, statePills),
    el('div', { class: 'details' }, [note, cost, excited]),
  ]);
}

/**
 * Builds the inside of the Projects section: one block per area.
 * @param {object} house - House supplying the current project values.
 * @returns {HTMLElement[]} The section's contents.
 */
function projectsSection(house) {
  const blocks = [];
  for (const area of PROJECT_AREAS) blocks.push(projectField(area, house.projects[area]));
  return [el('div', { class: 'fields' }, blocks)];
}

/**
 * Sets one project area's controls to match the draft and shows only the parts that apply.
 * @param {HTMLFormElement} form - Form containing the project controls.
 * @param {object} draft - House draft being edited.
 * @param {string} area - Project area key.
 */
function showProject(form, draft, area) {
  const project = draft.projects[area];
  const block = form.querySelector(`[data-project="${area}"]`);
  for (const input of block.querySelectorAll(`input[name="${projectFieldName(area, 'state')}"]`)) {
    input.checked = input.value === project.state;
  }
  for (const input of block.querySelectorAll(`input[name="${projectFieldName(area, 'excited')}"]`)) {
    input.checked = input.value === project.excited;
  }
  const cost = form.elements[projectFieldName(area, 'cost')];
  if (document.activeElement !== cost && Number.isFinite(project.cost)) cost.value = formatNumber(project.cost);
  if (document.activeElement !== cost && project.cost === null) cost.value = '';
  const hasWork = project.state === PROJECT_WANT || project.state === PROJECT_NEED;
  block.querySelector('[data-part="note"]').hidden = !hasWork;
  block.querySelector('[data-part="cost"]').hidden = !hasWork;
  block.querySelector('[data-part="excited"]').hidden = project.state !== PROJECT_WANT;
}

/**
 * Copies a changed project control's value into a draft.
 * @param {object} draft - House draft being edited; changed in place.
 * @param {HTMLInputElement} input - The control that changed.
 * @returns {string|null} The project area that changed, or null when the control is not a project control.
 */
function applyProjectInput(draft, input) {
  const control = parseProjectFieldName(input.name);
  if (control === null) return null;
  const { area, part } = control;
  let value = input.value;
  if (part === 'cost') {
    const parsed = parseNumberInput(input.value);
    value = parsed.valid ? parsed.value : NaN;
  } else if (part !== 'note' && value === '') {
    value = null;
  }
  Object.assign(draft, setProject(draft, area, { [part]: value }));
  return area;
}

/**
 * Copies a changed property control's value into a draft.
 * @param {HTMLFormElement} form - Form containing the control.
 * @param {object} draft - House draft being edited; changed in place.
 * @param {HTMLInputElement} input - The control that changed.
 * @returns {boolean} True when the control belongs to a property field.
 */
function applyFieldInput(form, draft, input) {
  const name = input.name;
  const definition = HOUSE_FIELDS[name];
  if (definition === undefined) return false;

  if (definition.kind === MULTI) {
    if (input.value === NONE_VALUE) draft[name] = toggleNone(draft[name]);
    else if (input.value === UNKNOWN_VALUE) draft[name] = null;
    else draft[name] = toggleOption(draft[name], input.value);
    showMultiChoice(form, name, draft[name]);
  } else if (definition.kind === NUMBER) {
    const parsed = parseNumberInput(input.value);
    draft[name] = parsed.valid ? parsed.value : NaN;
  } else if (definition.kind === TEXT) {
    draft[name] = input.value;
  } else {
    draft[name] = input.value === '' ? null : input.value;
  }
  return true;
}

/* --------------------------------------------------------------------------
   Add House
   -------------------------------------------------------------------------- */

/**
 * Builds the Add House view: the short form that creates a property with its basic facts.
 * @param {object} app - App context with the store, navigation, leave guard, and announce.
 * @returns {HTMLElement} Root element of the view.
 */
export function renderAddHouse(app) {
  const settings = app.store.get().settings;
  // Property Basics answers are collected here and copied onto the house when it is created.
  const draft = createHouse({ mlsNumber: '', address: '', listingPrice: null, listingDate: app.today() }, function noId() {
    return '';
  });
  let dirty = false;

  const basics = findSection('basics').fields;
  const mlsNumber = mlsNumberField('');
  const listingPrice = numberField({ name: 'listingPrice', label: 'Listing price', prefix: '$' }, null);
  const listingDate = textField({ name: 'listingDate', label: 'Listing date', type: 'date', wide: false }, app.today());
  const fields = [];
  for (const field of basics) {
    fields.push(houseField(field, draft, settings));
    // The MLS number, listing price, and listing date follow the address, ahead of the rest of the basics.
    if (field.name === 'address') fields.push(mlsNumber.node, listingPrice.node, listingDate.node);
  }

  const form = el('form', { class: 'house', novalidate: '' }, [
    el('section', { class: 'card' }, [el('div', { class: 'fields' }, fields)]),
    el('div', { class: 'actions' }, [
      el('button', { class: 'button', type: 'submit', value: 'exit' }, ['Save & Exit']),
      el('button', { class: 'button primary', type: 'submit', value: 'continue' }, ['Save & Continue']),
    ]),
  ]);

  // Every field in screen order, for showing errors and focusing the first one.
  const fieldOrder = ['address', 'mlsNumber', 'listingPrice', 'listingDate'];
  for (const field of basics) {
    if (field.name !== 'address') fieldOrder.push(field.name);
  }

  /**
   * Reads the values needed to create the house.
   * @returns {{ mlsNumber: string, address: string, listingPrice: number|null, listingDate: string, imageUrl: string }} Values; NaN price is unreadable text.
   */
  function readCreation() {
    const price = parseNumberInput(listingPrice.input.value);
    return {
      mlsNumber: mlsNumber.input.value,
      address: draft.address,
      listingPrice: price.valid ? price.value : NaN,
      listingDate: listingDate.input.value,
      imageUrl: draft.imageUrl,
    };
  }

  /**
   * Checks every field, combining the creation rules with the property-field rules.
   * @returns {Object<string, string>} Message per invalid field name.
   */
  function findErrors() {
    return { ...validateHouse(draft).errors, ...validateNewHouse(readCreation(), app.store.get().houses).errors };
  }

  /**
   * Copies a changed control into the draft.
   * @param {InputEvent} event - Input event from inside the form.
   */
  function handleInput(event) {
    applyFieldInput(form, draft, event.target);
    dirty = true;
  }

  /**
   * Validates a field as the user leaves it.
   * @param {FocusEvent} event - Focus-out event from inside the form.
   */
  function handleFieldLeave(event) {
    const name = event.target.name;
    if (!fieldOrder.includes(name)) return;
    showFieldError(form, name, findErrors()[name] || '');
  }

  /**
   * Checks whether anything has been entered that leaving would lose.
   * @returns {boolean} True when any field has been changed.
   */
  function isDirty() {
    return dirty;
  }

  /**
   * Creates the house when the form is submitted, then leaves by the chosen button.
   * @param {SubmitEvent} event - Submit event from the Add House form.
   */
  function handleSubmit(event) {
    event.preventDefault();
    const errors = findErrors();
    let firstInvalid = null;
    for (const name of fieldOrder) {
      showFieldError(form, name, errors[name] || '');
      if (errors[name] && firstInvalid === null) firstInvalid = form.elements[name];
    }
    if (firstInvalid !== null) {
      firstInvalid.focus();
      return;
    }

    const creation = readCreation();
    const house = createHouse(creation);
    for (const field of basics) {
      if (field.name !== 'address' && field.name !== 'imageUrl') house[field.name] = draft[field.name];
    }

    const data = app.store.get();
    const saved = app.store.update(saveHouse(data, normalizeHouse(house)));
    dirty = false;
    app.announce(saved ? 'House added.' : 'House added, but this browser could not store it.');
    const goOn = event.submitter !== null && event.submitter.value === 'continue';
    app.navigate(goOn ? `#/house/${house.id}/edit` : '#/');
  }

  form.addEventListener('input', handleInput);
  form.addEventListener('focusout', formatOnLeave);
  form.addEventListener('focusout', handleFieldLeave);
  form.addEventListener('submit', handleSubmit);
  app.setLeaveGuard(isDirty);

  return el('section', { class: 'entry' }, [pageTitle('Add House'), form]);
}

/* --------------------------------------------------------------------------
   Full property form
   -------------------------------------------------------------------------- */

/**
 * Builds the full property form for an existing house.
 * @param {object} app - App context with the store, navigation, leave guard, and announce.
 * @param {object} house - The stored house being edited.
 * @returns {HTMLElement} Root element of the view.
 */
export function renderHouseForm(app, house) {
  const settings = app.store.get().settings;
  // Edits live in this copy until the user saves.
  const draft = structuredClone(house);
  let dirty = false;
  // Listing Date is a correction applied on save, so the initial price entry can move with it.
  const listingDate = textField({ name: 'listingDate', label: 'Listing date', type: 'date', wide: false }, house.listingDate);
  // The MLS number is the house's id, so entering or correcting it renames the house on save.
  const hasMlsNumber = isMlsNumber(house.id);
  const mlsNumber = mlsNumberField(hasMlsNumber ? house.id : '', hasMlsNumber ? undefined : 'Not entered yet. It links this house to its listing.');

  const sections = [];
  const sectionNodes = {};
  const form = el('form', { class: 'house', novalidate: '' });
  for (const section of HOUSE_SECTIONS) {
    let content;
    if (section.id === 'projects') {
      content = projectsSection(draft);
    } else {
      const fields = [];
      for (const field of section.fields) {
        fields.push(houseField(field, draft, settings));
        if (field.name === 'address') fields.push(mlsNumber.node);
        // Listing date sits beside Year built, after the full-width image URL.
        if (field.name === 'imageUrl') fields.push(listingDate.node);
      }
      content = [el('div', { class: 'fields' }, fields)];
    }
    const progress = el('span', { class: 'progress' });
    sectionNodes[section.id] = el('details', { class: 'card section', open: section.id === 'basics' ? '' : null }, [
      el('summary', { class: 'disclosure' }, [el('h2', {}, [section.title]), progress]),
      ...content,
    ]);
    sections.push({ id: section.id, counted: countedFields(section), progress });
  }
  const actions = el('div', { class: 'actions' }, [
    el('a', { class: 'button', href: `#/house/${house.id}` }, ['Cancel']),
    el('button', { class: 'button primary', type: 'submit' }, ['Save house']),
  ]);
  form.append(actions);

  const view = el('section', { class: 'entry' }, [pageTitle(house.address)]);
  const tourMedia = window.matchMedia(TOUR_ORDER_MEDIA);
  const mediaListeners = new AbortController();
  let nav = null;

  function arrangeSections() {
    // Moving the existing nodes keeps every answer, open section, and focus exactly as it was.
    const order = tourMedia.matches ? SECTION_ORDERS.tour : SECTION_ORDERS.research;
    const ordered = [];
    for (const id of order) {
      form.insertBefore(sectionNodes[id], actions);
      ordered.push(sectionNodes[id]);
    }
    const nextNav = sectionNav('Form sections', ordered);
    if (nav === null) view.append(nextNav, form);
    else nav.replaceWith(nextNav);
    nav = nextNav;
  }

  function handleOrderChange() {
    if (!form.isConnected) {
      mediaListeners.abort();
      return;
    }
    arrangeSections();
  }

  function refresh() {
    // Hide fields whose parent answer makes them not applicable; their values are kept but ignored.
    for (const node of form.querySelectorAll('[data-field]')) {
      if (HOUSE_FIELDS[node.dataset.field] !== undefined) node.hidden = !isFieldApplicable(draft, node.dataset.field);
    }
    for (const area of PROJECT_AREAS) showProject(form, draft, area);
    for (const section of sections) {
      // Projects are counted from their areas rather than from house fields, but read the same way.
      const { known, total } = section.id === 'projects' ? projectsProgress(draft) : sectionProgress(draft, section.counted);
      section.progress.textContent = knownCountText(known, total);
      section.progress.dataset.level = progressLevel(known, total);
    }
  }

  /**
   * Copies one control's new value into the draft.
   * @param {InputEvent} event - Input event from inside the form.
   */
  function handleInput(event) {
    const input = event.target;
    if (input.name === 'listingDate' || input.name === 'mlsNumber') {
      dirty = true;
      return;
    }
    if (!applyFieldInput(form, draft, input) && applyProjectInput(draft, input) === null) return;
    dirty = true;
    refresh();
  }

  /**
   * Words what is wrong with the MLS number as entered; a house that never had one may still be saved without it.
   * @returns {string|null} The message, or null when it can be saved.
   */
  function mlsNumberProblem() {
    if (!hasMlsNumber && mlsNumber.input.value.trim() === '') return null;
    return mlsNumberError(app.store.get().houses, mlsNumber.input.value, house.id);
  }

  /**
   * Validates a typed field as the user leaves it.
   * @param {FocusEvent} event - Focus-out event from inside the form.
   */
  function handleFieldLeave(event) {
    const name = event.target.name;
    if (name === 'mlsNumber') {
      showFieldError(form, name, mlsNumberProblem() || '');
      return;
    }
    if (name === 'listingDate') {
      showFieldError(form, name, validateListingDate(draft, listingDate.input.value).errors.listingDate || '');
      return;
    }
    if (HOUSE_FIELDS[name] === undefined && parseProjectFieldName(name) === null) return;
    showFieldError(form, name, validateHouse(draft).errors[name] || '');
  }

  /**
   * Validates and saves the house when the form is submitted.
   * @param {SubmitEvent} event - Submit event from the property form.
   */
  function handleSubmit(event) {
    event.preventDefault();
    const result = validateHouse(draft);
    const dateErrors = validateListingDate(draft, listingDate.input.value).errors;
    showFieldError(form, 'listingDate', dateErrors.listingDate || '');
    const mlsProblem = mlsNumberProblem();
    showFieldError(form, 'mlsNumber', mlsProblem || '');
    for (const section of HOUSE_SECTIONS) {
      for (const field of section.fields) showFieldError(form, field.name, result.errors[field.name] || '');
    }
    for (const area of PROJECT_AREAS) {
      const name = projectFieldName(area, 'cost');
      showFieldError(form, name, result.errors[name] || '');
    }
    // The first invalid field on screen, whichever section order is showing.
    const firstInvalid = form.querySelector('[aria-invalid="true"]');
    if (!result.ok || dateErrors.listingDate !== undefined || mlsProblem !== null) {
      firstInvalid.closest('details').open = true;
      firstInvalid.focus();
      app.announce('Some fields need fixing before this can be saved.');
      return;
    }
    const data = app.store.get();
    dirty = false;
    const corrected = listingDate.input.value === house.listingDate ? draft : setListingDate(draft, listingDate.input.value);
    const id = mlsNumber.input.value.trim() === '' ? house.id : mlsNumber.input.value.trim();
    // A hidden house stays hidden from the Price Ladder under its new id.
    if (id !== house.id) app.setLadderPrefs(renameLadderHidden(app.ladderPrefs, house.id, id));
    // Going to the new address first means the redraw after saving finds the house, even under a new id.
    app.navigate(`#/house/${id}`);
    const saved = app.store.update(saveHouse(data, normalizeHouse({ ...corrected, id }), house.id));
    app.announce(saved ? 'House saved.' : 'House changed, but this browser could not store it.');
  }

  /**
   * Checks whether the form has unsaved changes.
   * @returns {boolean} True when anything has been edited since the form opened.
   */
  function isDirty() {
    return dirty;
  }

  form.addEventListener('input', handleInput);
  form.addEventListener('focusout', formatOnLeave);
  form.addEventListener('focusout', handleFieldLeave);
  form.addEventListener('submit', handleSubmit);
  tourMedia.addEventListener('change', handleOrderChange, { signal: mediaListeners.signal });
  app.setLeaveGuard(isDirty);
  arrangeSections();
  refresh();

  return view;
}

/* --------------------------------------------------------------------------
   House Detail actions: price history, Listing Date, status, and deleting
   -------------------------------------------------------------------------- */

/**
 * Opens a small modal form; it is removed from the page once closed.
 * @param {{ title: string, fields: HTMLElement[], extra?: HTMLElement|null, submit?: function(HTMLFormElement, function(): void): void }} options - Title, fields, an optional extra button, and the save handler, which receives the form and a close function; without one the dialog only has Close.
 * @returns {HTMLDialogElement} The open dialog.
 */
function openDialog(options) {
  const cancel = el('button', { class: 'button', type: 'button' }, [options.submit ? 'Cancel' : 'Close']);
  const form = el('form', { novalidate: '' }, [
    el('h2', { id: 'editor-title' }, [options.title]),
    el('div', { class: 'fields' }, options.fields),
    el('div', { class: 'actions' }, [
      options.extra || null,
      cancel,
      options.submit ? el('button', { class: 'button primary', type: 'submit' }, ['Save']) : null,
    ]),
  ]);
  const dialog = el('dialog', { class: 'editor', 'aria-labelledby': 'editor-title' }, [form]);

  function close() {
    dialog.close();
  }
  function handleClose() {
    window.removeEventListener('hashchange', close);
    dialog.remove();
  }
  /**
   * Hands a submitted form to the save handler.
   * @param {SubmitEvent} event - Submit event from the dialog's form.
   */
  function handleSubmit(event) {
    event.preventDefault();
    if (options.submit) options.submit(form, close);
  }

  cancel.addEventListener('click', close);
  form.addEventListener('submit', handleSubmit);
  form.addEventListener('focusout', formatOnLeave);
  dialog.addEventListener('close', handleClose);
  // Leaving the page, such as with the back button, closes the dialog with it.
  window.addEventListener('hashchange', close);
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

/**
 * Shows each error in a dialog form and focuses the first invalid field.
 * @param {HTMLFormElement} form - The dialog's form.
 * @param {string[]} names - Field names in screen order.
 * @param {Object<string, string>} errors - Message per invalid field name.
 * @returns {boolean} True when there were no errors.
 */
function showDialogErrors(form, names, errors) {
  let firstInvalid = null;
  for (const name of names) {
    showFieldError(form, name, errors[name] || '');
    if (errors[name] && firstInvalid === null) firstInvalid = form.elements[name];
  }
  if (firstInvalid !== null) firstInvalid.focus();
  return firstInvalid === null;
}

/**
 * Builds the House Detail actions for one house: Update price, Change status, and delete.
 * @param {object} app - App context with the store, navigation, confirm, today, and announce.
 * @param {object} house - The stored house shown on House Detail.
 * @returns {{ updatePrice: Function, changeStatus: Function, deleteHouse: Function }} Button handlers.
 */
export function houseActions(app, house) {
  /**
   * Stores a changed house and says so.
   * @param {object} next - The changed house.
   * @param {string} message - Confirmation to announce.
   */
  function store(next, message) {
    const saved = app.store.update(saveHouse(app.store.get(), normalizeHouse(next)));
    app.announce(saved ? message : 'Changed, but this browser could not store it.');
  }

  /**
   * Opens the price dialog to add a change, or to correct or delete an existing entry.
   * @param {{ id: string, price: number, date: string }|null} entry - Entry to correct, or null to add one.
   */
  function openPrice(entry) {
    const fields = [];
    const price = numberField({ name: 'price', label: 'Listing price', prefix: '$' }, entry === null ? null : entry.price);
    // A new price change starts on today's date; the user changes it when the change was earlier.
    const date = textField({ name: 'date', label: 'Effective date', type: 'date', wide: false }, entry === null ? app.today() : entry.date);
    let remove = null;
    if (entry !== null && canDeletePriceEntry(house)) {
      remove = el('button', { class: 'button danger', type: 'button' }, ['Delete']);
      /**
       * Closes the price dialog and deletes the entry once confirmed.
       * @returns {Promise<void>} Resolves once the user has answered.
       */
      remove.addEventListener('click', async function deleteEntry() {
        dialog.close();
        const ok = await app.confirm({
          title: 'Delete this price?',
          text: `The ${formatMoney(entry.price)} listing price from ${formatDate(entry.date)} will be removed from the history.`,
          confirmLabel: 'Delete price',
          cancelLabel: 'Keep it',
        });
        if (ok) store(deletePriceEntry(house, entry.id), 'Price deleted.');
      });
    }

    /**
     * Validates and stores the entry.
     * @param {HTMLFormElement} form - The dialog's form.
     * @param {function(): void} close - Closes the dialog.
     */
    function submit(form, close) {
      const parsed = parseNumberInput(price.input.value);
      const input = { price: parsed.valid ? parsed.value : NaN, date: date.input.value };
      if (!showDialogErrors(form, ['price', 'date'], validatePriceEntry(house, input).errors)) return;
      close();
      if (entry === null) store(addPriceEntry(house, input), 'Price updated.');
      else store(updatePriceEntry(house, entry.id, input), 'Price corrected.');
    }

    fields.push(price.node, date.node);
    if (entry === null) {
      // Correcting earlier entries is maintenance, so it is a quiet path out of recording a new price.
      const manage = el('button', { type: 'button' }, ['Manage price history']);
      manage.addEventListener('click', function openHistory() {
        dialog.close();
        manageHistory();
      });
      fields.push(el('p', { class: 'manage' }, [manage]));
    }

    const title = entry === null ? 'Update price' : 'Edit listing price';
    const dialog = openDialog({ title, fields, extra: remove, submit });
  }

  function updatePrice() {
    openPrice(null);
  }

  function manageHistory() {
    const rows = [];
    for (const entry of [...house.priceHistory].reverse()) {
      const edit = el('button', { class: 'button', type: 'button', 'aria-label': `Edit the ${formatMoney(entry.price)} price from ${formatDate(entry.date)}` }, ['Edit']);
      edit.addEventListener('click', function editEntry() {
        dialog.close();
        openPrice(entry);
      });
      rows.push(el('li', {}, [el('span', {}, [formatDate(entry.date)]), el('span', { class: 'amount' }, [formatMoney(entry.price)]), edit]));
    }
    const dialog = openDialog({ title: 'Price history', fields: [el('ul', { class: 'history' }, rows)] });
  }

  function changeStatus() {
    const pills = [];
    for (const status of STATUSES) {
      pills.push(choicePill('radio', 'status', status, STATUS_LABELS[status], status === house.status));
    }
    const choice = choiceFieldset({ name: 'status', label: 'Status' }, pills, true);
    const date = textField({ name: 'statusDate', label: '', type: 'date', wide: false }, '');

    /**
     * Shows the date field for the chosen status, filled with its default date.
     * @param {string} status - Chosen status.
     */
    function showStatusDate(status) {
      date.node.hidden = status === STATUS_AVAILABLE;
      // Available has no Status Date, and the field is hidden for it.
      if (status !== STATUS_AVAILABLE) date.node.querySelector('.label').textContent = STATUS_DATE_LABELS[status];
      date.input.value = defaultStatusDate(house, status, app.today()) || '';
      date.error.textContent = '';
    }

    /**
     * Validates and stores the status.
     * @param {HTMLFormElement} form - The dialog's form.
     * @param {function(): void} close - Closes the dialog.
     */
    function submit(form, close) {
      const status = form.elements.status.value;
      const statusDate = status === STATUS_AVAILABLE ? null : date.input.value;
      if (!showDialogErrors(form, ['statusDate'], validateStatus(house, status, statusDate).errors)) return;
      close();
      store(setStatus(house, status, statusDate), `Status set to ${STATUS_LABELS[status]}.`);
    }

    showStatusDate(house.status);
    // The dialog opens on the selected status, not the first pill.
    choice.querySelector('input:checked').setAttribute('autofocus', '');
    /**
     * Shows the date field for the status just chosen.
     * @param {Event} event - Change event from a status pill.
     */
    choice.addEventListener('change', function handleStatusChange(event) {
      showStatusDate(event.target.value);
    });
    openDialog({ title: 'Change status', fields: [choice, date.node], submit });
  }

  /**
   * Deletes the house once the user confirms, then returns to the Houses collection.
   * @returns {Promise<void>} Resolves once the user has answered.
   */
  async function removeHouse() {
    const ok = await app.confirm({
      title: `Delete ${house.address}?`,
      text: 'This permanently removes the house and everything recorded about it. It cannot be undone.',
      confirmLabel: 'Delete house',
      cancelLabel: 'Keep house',
    });
    if (!ok) return;
    // Leave first, so the view that follows the change is the Houses collection.
    app.navigate('#/');
    const saved = app.store.update(deleteHouse(app.store.get(), house.id));
    app.announce(saved ? 'House deleted.' : 'House deleted, but this browser could not store the change.');
  }

  return { updatePrice, changeStatus, deleteHouse: removeHouse };
}
