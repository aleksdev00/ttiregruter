// Read-only mapping reference extracted from the existing TTI Apps Script.
// Source SHA256: b064ede09e6bae95803cf0895a50e407b397ad64ca8d36ac0d6c5735a7fbcebf
const TTI_HQ_SPREADSHEET_ID = '104uFaGDXLHS3Fk6it8nSRESKcemTSnjPE1TngGdpzSU';

const TTI_APP_ID_COLUMN = 21;

const TTI_EMAIL_STATUS_COLUMN = 22;

function writeHqRow_(sheet, row, payload) {
  const driver = payload.driver || {};
  const recruiter = payload.recruiter || {};
  const company = payload.finalCompany || {};
  const completedAt = payload.completedAtUtc ? new Date(payload.completedAtUtc) : new Date();
  const experience = value_(driver.experienceText) || (driver.experienceMonths === null || driver.experienceMonths === undefined ? '' : String(driver.experienceMonths) + ' months');
  const companyOffer = [
    value_(company.name),
    [value_(company.employmentType), value_(company.trailer), value_(company.position), value_(company.pay)].filter(Boolean).join(' · ')
  ].filter(Boolean).join(' — ');
  const notes = completionNotes_(payload);
  const values = [[
    completedAt,
    value_(recruiter.name || recruiter.email),
    value_(driver.firstName),
    value_(driver.lastName),
    value_(driver.phone),
    Boolean(driver.consentConfirmed),
    value_(driver.state),
    value_(driver.cdl),
    experience,
    value_(driver.equipmentPreference || company.trailer),
    value_(driver.sapStatus),
    value_(driver.desiredPosition || company.position),
    'Interno finalizovano',
    completedAt,
    '',
    companyOffer,
    notes,
    true,
    value_(driver.email)
  ]];
  sheet.getRange(row, 1, 1, 19).setValues(values.map(function(record) { return record.map(safeCell_); }));
  sheet.getRange(row, TTI_APP_ID_COLUMN).setValue(payload.idempotencyKey);
  if (String(sheet.getRange(row, TTI_EMAIL_STATUS_COLUMN).getValue() || '') !== 'SENT') {
    sheet.getRange(row, TTI_EMAIL_STATUS_COLUMN).setValue('PENDING');
  }
}

function completionNotes_(payload) {
  const driver = payload.driver || {};
  const recruiter = payload.recruiter || {};
  const company = payload.finalCompany || {};
  return [
    'FINAL COMPANY SELECTED — recruiter completed the application process.',
    'TTI Application ID: ' + value_(payload.idempotencyKey),
    'Recruiter email: ' + value_(recruiter.email),
    'Driver start availability: ' + value_(driver.startAvailability),
    'Consent timestamp UTC: ' + value_(driver.consentTimestampUtc),
    'Consent text version: ' + value_(driver.consentTextVersion),
    'Pre-qualification: ' + value_(driver.prequalificationStatus),
    'Truck preference: ' + value_(driver.truckPreference),
    'Transmission preference: ' + value_(driver.transmissionPreference),
    'Home time preference: ' + value_(driver.homeTime),
    'W-2 / 1099 preference: ' + value_(driver.employmentTypePreference),
    'Route preference: ' + value_(driver.routePreference),
    'Location / ZIP: ' + value_(driver.locationZip),
    'Pay target: ' + value_(driver.payTarget),
    'Main priority: ' + value_(driver.mainPriority),
    'Deal-breakers: ' + value_(driver.dealbreakers),
    'Application source: ' + value_(driver.source),
    'Final company: ' + value_(company.name),
    'Offer ID: ' + value_(company.offerId),
    'Employment type: ' + value_(company.employmentType),
    'Trailer: ' + value_(company.trailer),
    'Position: ' + value_(company.position),
    'Trucks: ' + join_(company.trucks),
    'Route: ' + join_(company.route),
    'Home / days out: ' + value_(company.homeDaysOut),
    'Minimum experience months: ' + value_(company.minimumExperienceMonths),
    'Pay from offer: ' + value_(company.pay),
    'Offer notes: ' + value_(company.offerNotes),
    'Company notes: ' + value_(company.companyNotes),
    'Company contact: ' + value_(company.contact),
    'Source URL: ' + value_(company.sourceUrl),
    ...(company.employmentType === 'W-2' && driver.w2Application ? ['W-2 application packet: ' + JSON.stringify(driver.w2Application)] : []),
    'Driver notes: ' + value_(driver.notes)
  ].join('\n').slice(0, 49000);
}

function safeCell_(value) {
  return typeof value === 'string' && /^\s*[=+@-]/.test(value) ? "'" + value : value;
}

function ensureCrmRecord_(daily, dailyRow, payload) {
    const crm = SpreadsheetApp.openById(TTI_HQ_SPREADSHEET_ID).getSheetByName('Driver CRM');
    if (!crm)
        throw new Error('Driver CRM is missing; HQ record is retained for retry.');
    const appCol = ensureHeader_(crm, 'TTI Application ID');
    const driverCol = ensureHeader_(crm, 'TTI Driver ID');
    const stateCol = ensureHeader_(crm, 'TTI Sync Status');
    const stageCol = ensureHeader_(crm, 'TTI Pipeline Stage');
    const employmentCol = ensureHeader_(crm, 'TTI Employment Type');
    const id = String(payload.idempotencyKey);
    const driverId = String(payload.driver.id);
    let row = 0;
    crm.getRange(2, appCol, Math.max(1, crm.getMaxRows() - 1), 1).getDisplayValues()
        .forEach(function (value, index) {
        if (value[0] !== id)
            return;
        if (row)
            throw new Error('Duplicate CRM application ID; manual review required.');
        row = index + 2;
    });
    if (!row) {
        const pattern = new RegExp("'Recruiter Daily Updates'!\\$?C\\$?" + dailyRow + '(?![0-9])');
        const matches = [];
        crm.getRange(2, 2, Math.max(1, crm.getMaxRows() - 1), 1).getFormulas()
            .forEach(function (value, index) {
            if (pattern.test(value[0] || '') && !crm.getRange(index + 2, appCol).getValue())
                matches.push(index + 2);
        });
        if (matches.length > 1)
            throw new Error('Multiple legacy CRM links; manual review required.');
        if (matches.length === 1) {
            const candidate = matches[0];
            const history = crm.getRange(candidate, 4, 1, 21).getValues()[0];
            if (history.some(function (v) { return v !== '' && v !== null && v !== false && v !== 0; })) {
                throw new Error('Legacy CRM row already has manual history. Reconcile its ID first.');
            }
            row = candidate;
        }
    }
    if (!row) {
        row = crm.getMaxRows() + 1;
        crm.insertRowsAfter(crm.getMaxRows(), 1);
        const previous = crm.getRange(row - 1, 1, 1, crm.getLastColumn());
        const destination = crm.getRange(row, 1, 1, crm.getLastColumn());
        previous.copyTo(destination, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
        previous.copyTo(destination, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
        previous.getFormulasR1C1()[0].forEach(function (formula, index) {
            if (formula && [1, 2, 3, 4, 6, appCol - 1, driverCol - 1, stateCol - 1, stageCol - 1].indexOf(index) < 0) {
                crm.getRange(row, index + 1).setFormulaR1C1(formula);
            }
        });
    }
    const existingDriver = String(crm.getRange(row, driverCol).getValue() || '');
    if (existingDriver && existingDriver !== driverId)
        throw new Error('CRM driver identity conflict.');
    const state = String(crm.getRange(row, stateCol).getValue() || '');
    // Reserve before writing identity fields, just like the HQ row.
    reserveMetadata_(crm,row,[[appCol,id],[driverCol,driverId],
        [stateCol,state === 'synced' ? 'synced' : 'processing']]);
    SpreadsheetApp.flush();
    if (state !== 'synced') {
        const d = payload.driver, c = payload.finalCompany || {}, recruiter = payload.recruiter || {};
        crm.getRange(row, 2, 1, 4).setValues([[
                safeCell_([d.firstName, d.lastName].filter(Boolean).join(' ')),
                safeCell_(d.phone || ''), safeCell_(c.name || ''), safeCell_(recruiter.name || recruiter.email || '')
            ]]);
        if (!crm.getRange(row, 7).getValue())
            crm.getRange(row, 7).setValue(new Date(payload.completedAtUtc));
        if (!crm.getRange(row, stageCol).getValue())
            crm.getRange(row, stageCol).setValue('internally_finalized');
        crm.getRange(row, employmentCol).setValue(safeCell_(c.employmentType || ''));
    }
    SpreadsheetApp.flush();
    if (String(crm.getRange(row, appCol).getValue()) !== id || String(crm.getRange(row, driverCol).getValue()) !== driverId) {
        throw new Error('Driver CRM readback failed.');
    }
    crm.getRange(row, stateCol).setValue('synced');
    SpreadsheetApp.flush();
    return { ok: true, recordId: id, rowNumber: row };
}

function ensureHeader_(sheet,title) {
  const last=sheet.getLastColumn();
  const headers=sheet.getRange(1,1,1,last).getDisplayValues()[0];
  const found=headers.indexOf(title);
  if(found>=0 && headers.lastIndexOf(title)!==found)throw new Error('Duplicate integration header: '+title);
  if(found>=0)return found+1;
  if(last>=sheet.getMaxColumns())sheet.insertColumnsAfter(sheet.getMaxColumns(),1);
  sheet.getRange(1,last+1).setValue(title);return last+1;
}

function value_(value) {
  return value === null || value === undefined ? '' : String(value);
}

function reserveMetadata_(sheet,row,entries) {
  const columns=entries.map(function(entry){return entry[0];});
  const first=Math.min.apply(null,columns),last=Math.max.apply(null,columns);
  const range=sheet.getRange(row,first,1,last-first+1);
  const values=range.getValues()[0],formulas=range.getFormulas()[0];
  const preserved=values.map(function(value,index){return formulas[index] || safeCell_(value);});
  entries.forEach(function(entry){preserved[entry[0]-first]=safeCell_(entry[1]);});
  range.setValues([preserved]);
}

function join_(value) {
  return Array.isArray(value) ? value.join(', ') : value_(value);
}
