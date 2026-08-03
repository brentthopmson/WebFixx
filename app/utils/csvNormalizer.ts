export const STANDARD_88_COLUMNS = [
  'SN',
  'FIRSTNAME', 'LASTNAME', 'EMAIL', 'ADDRESS', 'CITY', 'STATE', 'COUNTRY', 'ZIPCODE', 'PHONE', 'SEX',
  'BUSINESSNAME', 'BUSINESSADDRESS', 'BUSINESSCITY', 'BUSINESSSTATE', 'BUSINESSCOUNTRY', 'BUSINESSZIPCODE', 'BUSINESSPHONE', 'BUSINESSEMAIL',
  'SOCIALPLATFORM', 'SOCIALUSERNAME', 'SOCIALPHONE',
  'CONTEXT',
  '', '', '', '', '', '',
  'campaignType', 'engine', 'provider',
  'shooterFirstName', 'shooterLastName', 'shooterEmail', 'shooterAddress', 'shooterCity', 'shooterState', 'shooterCountry', 'shooterZipCode', 'shooterPhone', 'shooterSex',
  'smtp', 'port', 'username', 'password', 'appPassword', 'backupCode', 'oAuth2ClientId', 'oAuth2ClientSecret', 'oAuth2RefreshToken',
  '',
  'shouldValidate', 'shouldEnhance', 'shouldSearchInteract', 'shouldPageInteract', 'shouldInboxInteract', 'shouldActivitiesInteract', 'shouldSendMessage',
  '', '',
  'emailSubject', 'emailBody', 'socialMessage', 'replyTo',
  '', '', '',
  'validation', 'providerMXResult', 'enhancedSubject', 'enhancedBody', 'enhancedSocialMessage',
  '', '',
  'sendDate', 'sendTime', 'sendStamp',
  '', '', '',
  'searchKeys', 'searchCount', 'searchStatus', 'searchStamp',
  '',
  'profileToInteract', 'interactCount', 'interactStatus', 'interactStamp'
];

const FUZZY_MAP: Record<string, string[]> = {
  EMAIL: ['EMAIL', 'MAIL', 'E-MAIL', 'LEAD'],
  FIRSTNAME: ['FIRST', 'FIRST NAME', 'FNAME', 'GIVEN'],
  LASTNAME: ['LAST', 'LAST NAME', 'LNAME', 'SURNAME', 'FAMILY'],
  ADDRESS: ['ADDRESS', 'STREET'],
  CITY: ['CITY', 'TOWN'],
  STATE: ['STATE', 'PROVINCE', 'REGION'],
  COUNTRY: ['COUNTRY', 'NATION'],
  ZIPCODE: ['ZIP', 'ZIPCODE', 'ZIP CODE', 'POSTAL', 'POSTCODE'],
  PHONE: ['PHONE', 'PHONENUMBER', 'PHONE NUMBER', 'TELEPHONE', 'TEL', 'MOBILE', 'CELL'],
  SEX: ['SEX', 'GENDER'],
  BUSINESSNAME: ['BUSINESS', 'BUSINESS NAME', 'COMPANY', 'ORGANIZATION', 'ORG'],
  BUSINESSADDRESS: ['BUSINESS ADDRESS', 'COMPANY ADDRESS'],
  BUSINESSCITY: ['BUSINESS CITY', 'COMPANY CITY'],
  BUSINESSSTATE: ['BUSINESS STATE', 'COMPANY STATE'],
  BUSINESSCOUNTRY: ['BUSINESS COUNTRY', 'COMPANY COUNTRY'],
  BUSINESSZIPCODE: ['BUSINESS ZIP', 'BUSINESS POSTAL', 'COMPANY ZIP'],
  BUSINESSPHONE: ['BUSINESS PHONE', 'COMPANY PHONE'],
  BUSINESSEMAIL: ['BUSINESS EMAIL', 'COMPANY EMAIL'],
  SOCIALPLATFORM: ['SOCIAL', 'SOCIAL PLATFORM', 'PLATFORM'],
  SOCIALUSERNAME: ['SOCIAL USERNAME', 'USERNAME', 'HANDLE', 'SOCIAL HANDLE'],
  SOCIALPHONE: ['SOCIAL PHONE']
};

function parseCSV(text: string): string[][] {
  // Auto-detect tab-delimited files
  const firstNewline = text.indexOf('\n');
  const firstLine = firstNewline > 0 ? text.slice(0, firstNewline) : text;
  if (firstLine.includes('\t') && !firstLine.includes(',')) {
    text = text.replace(/\t/g, ',');
  }

  const lines: string[][] = [];
  let row = [''];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"') {
        if (next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        row[row.length - 1] += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push('');
      } else if (c === '\r' || c === '\n') {
        if (c === '\r' && next === '\n') {
          i++;
        }
        lines.push(row);
        row = [''];
      } else {
        row[row.length - 1] += c;
      }
    }
  }
  if (row.length > 1 || row[0] !== '') {
    lines.push(row);
  }
  return lines;
}

function stringifyCSV(rows: string[][]): string {
  return rows.map(row =>
    row.map(val => {
      const str = String(val === null || val === undefined ? '' : val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }).join(',')
  ).join('\n');
}

export function normalizeCSV(rawCsvContent: string): { normalizedText: string, headers: string[], preview: string[][], totalRows: number, unmappedColumns: string[] } {
  const parsedRows = parseCSV(rawCsvContent);
  if (parsedRows.length === 0) {
    return { normalizedText: '', headers: STANDARD_88_COLUMNS, preview: [], totalRows: 0, unmappedColumns: [] };
  }

  const rawHeaders = parsedRows[0].map(h => h.trim().replace(/^[`'"\s]+|[`'"\s]+$/g, '').toUpperCase());
  const dataRows = parsedRows.slice(1);

  const normalizedRows: string[][] = [];
  const headerMap = new Map<number, number>();
  const unmappedColumns: string[] = [];

  const IMPORTANT_COLUMNS = ['EMAIL', 'FIRSTNAME', 'LASTNAME', 'PHONE'];

  STANDARD_88_COLUMNS.forEach((stdHeader, index) => {
    if (!stdHeader) return;

    const upperStd = stdHeader.toUpperCase();
    const exactIdx = rawHeaders.indexOf(upperStd);
    if (exactIdx !== -1) {
      headerMap.set(index, exactIdx);
      return;
    }

    const fuzzyKeys = FUZZY_MAP[upperStd];
    if (fuzzyKeys) {
      for (const alias of fuzzyKeys) {
        const aliasIdx = rawHeaders.findIndex(rh => rh === alias || rh.includes(alias));
        if (aliasIdx !== -1) {
          headerMap.set(index, aliasIdx);
          return;
        }
      }
    }

    if (IMPORTANT_COLUMNS.includes(upperStd)) {
      unmappedColumns.push(upperStd);
    }
  });

  if (unmappedColumns.length > 0) {
    console.warn(`[CSV Normalizer] Important columns not found: ${unmappedColumns.join(', ')}. Raw headers: [${rawHeaders.join(', ')}]`);
  }

  normalizedRows.push(STANDARD_88_COLUMNS.map(h => h));

  dataRows.forEach((row, idx) => {
    const newRow = new Array(STANDARD_88_COLUMNS.length).fill('');
    newRow[0] = String(idx + 1);
    STANDARD_88_COLUMNS.forEach((_, stdIndex) => {
      if (headerMap.has(stdIndex)) {
        const rawIndex = headerMap.get(stdIndex)!;
        newRow[stdIndex] = row[rawIndex] !== undefined && row[rawIndex] !== null ? String(row[rawIndex]) : '';
      }
    });
    normalizedRows.push(newRow);
  });

  const normalizedText = stringifyCSV(normalizedRows);
  const nonEmptyHeaders = STANDARD_88_COLUMNS.filter(h => h.length > 0);
  const firstDataRows = normalizedRows.slice(1, 6).map(row => row.slice(0, nonEmptyHeaders.length));

  return {
    normalizedText,
    headers: nonEmptyHeaders,
    preview: firstDataRows,
    totalRows: normalizedRows.length - 1,
    unmappedColumns
  };
}

export function buildCSVFromContacts(
  contacts: Array<{
    name?: string;
    email?: string;
    phone?: string | number;
    company?: string;
    platform?: string;
    username?: string;
  }>,
  category: 'WIRE' | 'SOCIAL',
  sender?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
    phone?: string;
    sex?: string;
  },
  subject?: string,
  body?: string
): string {
  const rows: string[][] = [STANDARD_88_COLUMNS.map(h => h)];

  contacts.forEach((contact, idx) => {
    const row = new Array(STANDARD_88_COLUMNS.length).fill('');
    row[0] = String(idx + 1);

    const nameParts = (contact.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    row[1] = firstName;
    row[2] = lastName;
    row[3] = contact.email || '';
    row[9] = String(contact.phone || '');

    if (contact.company) {
      row[11] = contact.company;
    }

    if (category === 'SOCIAL') {
      row[19] = contact.platform || '';
      row[20] = contact.username || '';
    }

    if (sender) {
      row[32] = sender.firstName || '';
      row[33] = sender.lastName || '';
      row[34] = sender.email || '';
      row[35] = sender.address || '';
      row[36] = sender.city || '';
      row[37] = sender.state || '';
      row[38] = sender.country || '';
      row[39] = sender.zipCode || '';
      row[40] = sender.phone || '';
      row[41] = sender.sex || '';
    }

    row[61] = subject || '';
    row[62] = body || '';

    rows.push(row);
  });

  return stringifyCSV(rows);
}

export function generateSampleCSV(): string {
  const columns = [
    'FIRSTNAME', 'LASTNAME', 'EMAIL', 'ADDRESS', 'CITY', 'STATE', 'COUNTRY', 'ZIPCODE', 'PHONE', 'SEX',
    'BUSINESSNAME', 'BUSINESSADDRESS', 'BUSINESSCITY', 'BUSINESSSTATE', 'BUSINESSCOUNTRY', 'BUSINESSZIPCODE', 'BUSINESSPHONE', 'BUSINESSEMAIL',
    'SOCIALPLATFORM', 'SOCIALUSERNAME', 'SOCIALPHONE', 'CONTEXT'
  ];

  const sampleRows = [
    'Robert,Anderson,robert.anderson@email.com,4521 Westbrook Ave,Chicago,IL,USA,60601,+13125551234,M,Pinnacle Solutions,890 Commerce Blvd,Chicago,IL,USA,60602,+13125559876,robert@pinnacle.com,LinkedIn,robert-anderson,,Interested in enterprise plan',
    'Maria,Garcia,maria.garcia@email.com,7823 Elm Street,Los Angeles,CA,USA,90001,+12135559876,F,Garcia Associates,456 Sunset Blvd,Los Angeles,CA,USA,90002,+12135551234,maria@garciaassoc.com,Twitter,@maria_garcia,,Requested product demo',
    'James,Williams,james.williams@email.com,234 Pine Ridge Rd,Houston,TX,USA,77001,+17135552345,M,Williams Tech,1200 Main St,Houston,TX,USA,77002,+17135556789,james@williams.tech,Facebook,james.williams,,Follow up Q2 proposal',
    'Patricia,Brown,patricia.brown@email.com,567 Maple Drive,Phoenix,AZ,USA,85001,+14805553456,F,Brown Consulting,8900 Camelback Rd,Phoenix,AZ,USA,85002,+14805557890,patricia@brownconsulting.com,Instagram,@patricia_brown,,Partnership inquiry',
    'Michael,Davis,michael.davis@email.com,890 Cedar Lane,Dallas,TX,USA,75201,+12145564567,M,Davis Enterprises,3200 Ross Ave,Dallas,TX,USA,75202,+12145568901,michael@davisco.com,LinkedIn,michael-davis,,Contract renewal'
  ];

  return [columns.join(','), ...sampleRows].join('\n');
}
