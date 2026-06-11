// Prop Dev DNA — Platform Information Memorandum Generator
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  ExternalHyperlink, TableOfContents
} = require('docx');
const fs = require('fs');
const path = require('path');

// ── Colour palette ─────────────────────────────────
const NAVY   = '0D1B2A';
const GOLD   = 'C9A84C';
const GOLD2  = 'E8C76A';
const WHITE  = 'FFFFFF';
const MUTED  = '6B7C93';
const GREEN  = '1E8449';
const LIGHT  = 'F4F6F9';
const BORDER = 'DDE3EE';
const DARK   = '1A2D42';

// ── Reusable style helpers ─────────────────────────
const goldRule = new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GOLD } },
  spacing: { after: 0 },
  children: []
});

function spacer(pts = 120) {
  return new Paragraph({ spacing: { before: pts, after: 0 }, children: [] });
}

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, font: 'Arial', size: 32, bold: true, color: NAVY })],
    spacing: { before: 360, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD } }
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, font: 'Arial', size: 26, bold: true, color: DARK })],
    spacing: { before: 240, after: 80 }
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, font: 'Arial', size: 22, bold: true, color: NAVY })],
    spacing: { before: 180, after: 60 }
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, font: 'Arial', size: 20, color: opts.color || '2C3E50', bold: opts.bold || false })],
    spacing: { before: opts.before || 60, after: opts.after || 80 },
    alignment: opts.align || AlignmentType.LEFT
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    children: [new TextRun({ text, font: 'Arial', size: 20, color: '2C3E50' })],
    spacing: { before: 40, after: 40 }
  });
}

function numberedItem(text) {
  return new Paragraph({
    numbering: { reference: 'numbered', level: 0 },
    children: [new TextRun({ text, font: 'Arial', size: 20, color: '2C3E50' })],
    spacing: { before: 40, after: 40 }
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function label(text) {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), font: 'Arial', size: 16, bold: true, color: GOLD, characterSpacing: 80 })],
    spacing: { before: 60, after: 40 }
  });
}

function navyBox(children) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: NAVY };
  const borders = { top: border, bottom: border, left: border, right: border };
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        borders,
        shading: { fill: NAVY, type: ShadingType.CLEAR },
        margins: { top: 280, bottom: 280, left: 360, right: 360 },
        width: { size: 9360, type: WidthType.DXA },
        children
      })]
    })]
  });
}

function goldBox(children) {
  const border = { style: BorderStyle.SINGLE, size: 6, color: GOLD };
  const borders = { top: border, bottom: border, left: border, right: border };
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        borders,
        shading: { fill: 'FFF8E7', type: ShadingType.CLEAR },
        margins: { top: 200, bottom: 200, left: 320, right: 320 },
        width: { size: 9360, type: WidthType.DXA },
        children
      })]
    })]
  });
}

function lightBox(children) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER };
  const borders = { top: border, bottom: border, left: border, right: border };
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        borders,
        shading: { fill: 'F4F6F9', type: ShadingType.CLEAR },
        margins: { top: 200, bottom: 200, left: 320, right: 320 },
        width: { size: 9360, type: WidthType.DXA },
        children
      })]
    })]
  });
}

function twoColMetrics(pairs) {
  // pairs = [{label, value}, ...]  — up to 4 pairs, 2 per row
  const rows = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const left = pairs[i];
    const right = pairs[i + 1];
    const cellBorder = { style: BorderStyle.NONE, size: 0, color: WHITE };
    const noBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
    const makeCell = (p) => new TableCell({
      borders: noBorders,
      shading: { fill: NAVY, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 200, right: 200 },
      width: { size: 4680, type: WidthType.DXA },
      children: p ? [
        new Paragraph({ children: [new TextRun({ text: p.value, font: 'Arial', size: 36, bold: true, color: GOLD2 })], spacing: { after: 20 } }),
        new Paragraph({ children: [new TextRun({ text: p.label, font: 'Arial', size: 17, color: 'A8BCD4', bold: false })] })
      ] : [new Paragraph({ children: [] })]
    });
    rows.push(new TableRow({ children: [makeCell(left), makeCell(right)] }));
  }
  const outerBorder = { style: BorderStyle.SINGLE, size: 1, color: NAVY };
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    borders: { top: outerBorder, bottom: outerBorder, left: outerBorder, right: outerBorder, insideH: outerBorder, insideV: outerBorder },
    rows
  });
}

function stepTable(steps) {
  // steps = [{num, title, desc}]
  const noBorder = { style: BorderStyle.NONE, size: 0, color: WHITE };
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
  const rows = steps.map(s => new TableRow({
    children: [
      new TableCell({
        borders: noBorders,
        shading: { fill: NAVY, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 160, right: 160 },
        width: { size: 600, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.num, font: 'Arial', size: 22, bold: true, color: GOLD })] })]
      }),
      new TableCell({
        borders: noBorders,
        shading: { fill: 'F4F6F9', type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 200, right: 200 },
        width: { size: 8760, type: WidthType.DXA },
        children: [
          new Paragraph({ children: [new TextRun({ text: s.title, font: 'Arial', size: 20, bold: true, color: NAVY })] }),
          new Paragraph({ children: [new TextRun({ text: s.desc, font: 'Arial', size: 19, color: '4A5568' })], spacing: { before: 40 } })
        ]
      })
    ]
  }));
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [600, 8760],
    rows
  });
}

function projectionTable(rows) {
  const hBorder = { style: BorderStyle.SINGLE, size: 1, color: BORDER };
  const hBorders = { top: hBorder, bottom: hBorder, left: hBorder, right: hBorder };
  const makeRow = (cells, isHeader = false) => new TableRow({
    children: cells.map((c, i) => new TableCell({
      borders: hBorders,
      shading: { fill: isHeader ? NAVY : (cells === rows[rows.length-1] ? 'E8F5E9' : WHITE), type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 140, right: 140 },
      width: { size: [2400, 2320, 2320, 2320][i] || 2320, type: WidthType.DXA },
      children: [new Paragraph({
        alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
        children: [new TextRun({ text: c, font: 'Arial', size: 19, bold: isHeader, color: isHeader ? GOLD2 : (i > 0 ? NAVY : '4A5568') })]
      })]
    }))
  });
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 2320, 2320, 2320],
    rows: [
      makeRow(['Milestone', 'Active Devs', 'Monthly ARR', 'Annual ARR'], true),
      ...rows.map(r => makeRow(r))
    ]
  });
}

// ── Build the document ─────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 560, hanging: 280 } } }
        }]
      },
      {
        reference: 'numbered',
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 560, hanging: 280 } } }
        }]
      }
    ]
  },
  styles: {
    default: { document: { run: { font: 'Arial', size: 20 } } },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: 'Arial', color: NAVY },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 }
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Arial', color: DARK },
        paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 }
      },
      {
        id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: 'Arial', color: NAVY },
        paragraph: { spacing: { before: 180, after: 60 }, outlineLevel: 2 }
      }
    ]
  },
  sections: [
    // ════════════════════════════════════════════════
    // SECTION A: COVER PAGE (no header/footer)
    // ════════════════════════════════════════════════
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      children: [
        spacer(360),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'CONFIDENTIAL', font: 'Arial', size: 18, bold: true, color: GOLD, characterSpacing: 200 })],
          spacing: { after: 80 }
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD } },
          children: [],
          spacing: { after: 120 }
        }),
        spacer(200),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: '🧬  PROP DEV DNA', font: 'Arial', size: 64, bold: true, color: NAVY })],
          spacing: { after: 100 }
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Platform Information Memorandum', font: 'Arial', size: 30, bold: false, color: MUTED })],
          spacing: { after: 60 }
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD } },
          children: [],
          spacing: { after: 200 }
        }),
        spacer(120),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Australia’s Professional Property Development Capital-Raising Platform", font: 'Arial', size: 24, italic: true, color: DARK })],
          spacing: { after: 240 }
        }),
        navyBox([
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'PREPARED FOR:  DEVELOPERS  ·  INVESTORS  ·  COMPLIANCE PARTNERS', font: 'Arial', size: 18, bold: true, color: GOLD2, characterSpacing: 80 })]
          })
        ]),
        spacer(480),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'May 2026', font: 'Arial', size: 20, color: MUTED })]
        }),
        spacer(80),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'propdevdna.com.au', font: 'Arial', size: 20, bold: true, color: GOLD })]
        }),
        spacer(400),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: BORDER } },
          children: [new TextRun({ text: 'This document is confidential and is intended solely for the named recipient. Not for distribution.', font: 'Arial', size: 16, color: MUTED, italic: true })],
          spacing: { before: 120, after: 0 }
        })
      ]
    },

    // ════════════════════════════════════════════════
    // SECTION B: TOC + BODY (with header/footer)
    // ════════════════════════════════════════════════
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1200, right: 1440, bottom: 1200, left: 1440 }
        }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD } },
              children: [
                new TextRun({ text: 'PROP DEV DNA', font: 'Arial', size: 18, bold: true, color: NAVY }),
                new TextRun({ text: '   |   CONFIDENTIAL — PLATFORM INFORMATION MEMORANDUM', font: 'Arial', size: 18, color: MUTED })
              ],
              spacing: { after: 80 }
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              border: { top: { style: BorderStyle.SINGLE, size: 2, color: BORDER } },
              children: [
                new TextRun({ text: 'propdevdna.com.au  |  May 2026  |  Page ', font: 'Arial', size: 16, color: MUTED }),
                new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: MUTED }),
                new TextRun({ text: '  of  ', font: 'Arial', size: 16, color: MUTED }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 16, color: MUTED })
              ],
              spacing: { before: 80 }
            })
          ]
        })
      },
      children: [
        // ── TABLE OF CONTENTS ─────────────────────────
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: 'Table of Contents', font: 'Arial', size: 32, bold: true, color: NAVY })]
        }),
        new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-2' }),
        pageBreak(),

        // ════════════════════════════════════════════
        // SECTION 1 — EXECUTIVE SUMMARY
        // ════════════════════════════════════════════
        label('Section 1'),
        heading1('Executive Summary'),
        body("Prop Dev DNA is a purpose-built SaaS platform that digitises the Australian property development capital-raising process. The platform bridges the gap between property developers seeking private capital and wholesale investors seeking institutional-grade deal flow — delivered through a structured, compliance-first technology layer."),
        spacer(120),
        twoColMetrics([
          { value: '$42B+', label: 'Target market — private dev finance p.a.' },
          { value: '$299/mo', label: 'Developer subscription — live now' },
          { value: '$538K', label: 'Target Year 1 ARR (150 developers)' },
          { value: '4', label: 'User roles: Admin, Developer, Investor, Buyers Agent' }
        ]),
        spacer(180),
        heading2('Platform Purpose'),
        lightBox([
          new Paragraph({
            children: [new TextRun({ text: '“Prop Dev DNA gives property developers the professional tools to present their projects compellingly, and gives wholesale investors a curated, compliance-checked pipeline of Australian development opportunities.”', font: 'Arial', size: 22, italic: true, color: NAVY })],
            alignment: AlignmentType.CENTER
          })
        ]),
        spacer(120),
        heading2('Platform Status'),
        body('✓  Live and operational at propdevdna.com.au', { bold: true, color: GREEN }),
        body('✓  FEASO feasibility builder — fully functional', { bold: false, color: '2C3E50' }),
        body('✓  16-page IM generator with mandatory compliance disclaimers', { color: '2C3E50' }),
        body('✓  IM quality review workflow — submit → amend → approve → certificate', { color: '2C3E50' }),
        body('✓  Compliance Review Certificate auto-prepended to approved IMs', { color: '2C3E50' }),
        body('✓  Investor wholesale acknowledgment gate with audit log', { color: '2C3E50' }),
        body('✓  Developer subscription gate ($299/month)', { color: '2C3E50' }),
        body('•  AFSL coverage via Authorised Representative arrangement — DF Partners (in discussion)', { color: MUTED }),
        pageBreak(),

        // ════════════════════════════════════════════
        // SECTION 2 — THE PROBLEM
        // ════════════════════════════════════════════
        label('Section 2'),
        heading1('The Problem'),
        body('The Australian property development capital-raising market is fragmented, document-poor, and under-digitised. Three groups bear the cost of this gap:'),

        spacer(80),
        heading2('2.1  For Property Developers'),
        body("Boutique developers — operators running 1–10 projects — typically raise capital through personal networks, broker relationships, and ad-hoc PDF documents. The result:"),
        bullet('Information Memorandums built in PowerPoint or Word with no standardisation'),
        bullet('No feasibility modelling discipline — assumptions vary wildly between developers'),
        bullet('No compliance review — documents go to investors without ASIC-aligned disclaimers'),
        bullet('No digital infrastructure — deals are done via email and phone calls'),
        bullet('No audit trail — who saw what and when is unknown'),
        spacer(80),
        body('This creates real risk: for the developer (poor presentation loses capital), for the investor (uninformed decisions), and for the intermediary (AFSL exposure without documented process).'),

        spacer(120),
        heading2('2.2  For Wholesale Investors'),
        body('Wholesale investors — HNW individuals, family offices, and SMSFs — seeking property development returns face:'),
        bullet('Inconsistent deal documentation — no standard format to compare opportunities'),
        bullet('No centralised pipeline — deals arrive through fragmented broker and personal networks'),
        bullet('No verification layer — developer track records are self-reported'),
        bullet('No compliance process — wholesale investor status is informally assumed, not documented'),

        spacer(120),
        heading2('2.3  For Finance Intermediaries'),
        body('Firms that facilitate developer–investor introductions face increasing regulatory scrutiny as the industry digitises. Operating without clear AFSL coverage for digital deal facilitation creates compliance exposure as the volume and visibility of introductions scales.'),
        pageBreak(),

        // ════════════════════════════════════════════
        // SECTION 3 — THE SOLUTION
        // ════════════════════════════════════════════
        label('Section 3'),
        heading1('The Solution — Prop Dev DNA'),
        body('Prop Dev DNA solves all three problems through a single integrated platform with five core modules:'),
        spacer(80),

        heading2('3.1  FEASO Feasibility Builder'),
        body('A live, auto-calculating feasibility engine that structures the full financial model of a development project. Developers input land cost, construction, units, selling prices, finance costs, GST, and agent commissions. The system outputs:'),
        bullet('Total Development Cost (TDC) and Gross Realisable Value (GRV)'),
        bullet('Net Revenue, Gross Development Profit, and profit margin on cost'),
        bullet('LVR, equity requirement, and IRR'),
        bullet('Full sensitivity analysis grid — revenue vs. cost variance scenarios'),
        bullet('Professional PDF feasibility report ready for lender or investor submission'),

        spacer(120),
        heading2('3.2  Information Memorandum Generator'),
        body('A 16-page automated IM generator that pulls all financial data from the FEASO and combines it with project details, architectural features, market comparables, developer profile, and funding structure. Every IM automatically includes:'),
        bullet('Mandatory ASIC-aligned disclaimers — locked, cannot be removed or edited by the developer'),
        bullet('Wholesale Investor Notice (Section 761G, Corporations Act 2001)'),
        bullet('General Advice Warning'),
        bullet('Forward-Looking Statements caveat'),
        bullet('Not a Prospectus declaration'),

        spacer(120),
        heading2('3.3  Compliance Review Workflow'),
        body('Before any IM reaches investors, it passes through a multi-round compliance review:'),
        spacer(80),
        stepTable([
          { num: '1', title: 'Developer Submits IM', desc: 'Developer submits the generated IM for review via the platform.' },
          { num: '2', title: 'Admin Reviews', desc: 'Compliance team reviews against a quality checklist — disclaimers, financial consistency, developer profile, formatting.' },
          { num: '3', title: 'Amendments Requested (if needed)', desc: 'Specific line items returned to developer with clear, actionable instructions.' },
          { num: '4', title: 'Developer Resubmits', desc: 'Developer addresses amendments, regenerates the IM, resubmits. Repeat until approved.' },
          { num: '5', title: 'Compliance Certificate Issued', desc: 'On approval, a Compliance Review Certificate is prepended to the IM as Page 1 — with reviewer name, date, and reference number.' }
        ]),

        spacer(180),
        heading2('3.4  Investor Deal Room'),
        body('A gated, authenticated environment where wholesale-verified investors can:'),
        bullet('Browse curated development opportunities with live funding progress'),
        bullet('Access compliance-checked IMs behind an acknowledgment gate'),
        bullet('Express interest directly through the platform'),
        bullet('Receive a timestamped, logged record of every document accessed'),

        spacer(120),
        heading2('3.5  Wholesale Investor Gate'),
        body('Every investor accessing deal documents must confirm their wholesale investor status and acknowledge all risk disclosures. Every confirmation is:'),
        bullet('Logged with a timestamp'),
        bullet('Linked to the specific investor account'),
        bullet('Linked to the specific listing and document accessed'),
        bullet('Stored in a permanent audit log accessible to the platform admin'),
        pageBreak(),

        // ════════════════════════════════════════════
        // SECTION 4 — FOR DEVELOPERS
        // ════════════════════════════════════════════
        label('Section 4'),
        heading1('For Property Developers'),

        heading2('4.1  Who Is This For?'),
        bullet('Boutique residential developers (5–100 dwellings)'),
        bullet('Commercial and mixed-use developers'),
        bullet('Buyers agents managing capital-raising on behalf of developer clients'),
        bullet('Development managers seeking professional documentation tools'),

        spacer(120),
        heading2('4.2  Developer Onboarding — Step by Step'),
        spacer(80),
        stepTable([
          { num: '1', title: 'Register as a Developer', desc: 'Create an account at propdevdna.com.au. Select the Developer role. Activate your Developer Plan ($299/month with a 7-day free trial).' },
          { num: '2', title: 'Create a Listing', desc: 'Add your project: name, location, type, photos, financial metrics, and capital structure (equity / preferred equity / debt). Your listing appears in the investor deal room once published.' },
          { num: '3', title: 'Build Your FEASO', desc: 'Open the FEASO Builder. Enter your project financials — the system calculates your complete feasibility in real time. Save your figures. These automatically populate the IM.' },
          { num: '4', title: 'Generate Your IM', desc: 'Open the IM Generator (Section 8 of the FEASO). Add project narrative, architectural details, market comparables, and contact details. Click Generate. A 16-page professional IM is produced instantly — complete with mandatory compliance disclaimers.' },
          { num: '5', title: 'Submit for Compliance Review', desc: 'Submit your IM to the Prop Dev DNA compliance team. Receive structured feedback within 1 business day. Address amendments, regenerate, and resubmit. On approval, receive your Compliance Review Certificate.' },
          { num: '6', title: 'Connect with Investors', desc: 'Approved IMs are visible to wholesale-verified investors. Track interest submissions via the Developer Portal. Receive investor leads with contact details, investment amount, and wholesale confirmation status.' }
        ]),

        spacer(180),
        heading2('4.3  Developer Pricing'),
        spacer(80),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [3120, 3120, 3120],
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, left: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, right: { style: BorderStyle.SINGLE, size: 1, color: BORDER } },
                  shading: { fill: NAVY, type: ShadingType.CLEAR },
                  margins: { top: 120, bottom: 120, left: 160, right: 160 },
                  width: { size: 3120, type: WidthType.DXA },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '', font: 'Arial', size: 20, bold: true, color: GOLD2 })] })]
                }),
                new TableCell({
                  borders: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, left: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, right: { style: BorderStyle.SINGLE, size: 1, color: BORDER } },
                  shading: { fill: NAVY, type: ShadingType.CLEAR },
                  margins: { top: 120, bottom: 120, left: 160, right: 160 },
                  width: { size: 3120, type: WidthType.DXA },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Monthly Plan', font: 'Arial', size: 20, bold: true, color: GOLD2 })] })]
                }),
                new TableCell({
                  borders: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, left: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, right: { style: BorderStyle.SINGLE, size: 1, color: BORDER } },
                  shading: { fill: NAVY, type: ShadingType.CLEAR },
                  margins: { top: 120, bottom: 120, left: 160, right: 160 },
                  width: { size: 3120, type: WidthType.DXA },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Annual Plan', font: 'Arial', size: 20, bold: true, color: GOLD2 })] })]
                })
              ]
            }),
            ...([
              ['Price', '$299/month', '$2,990/year (save $598)'],
              ['Trial', '7-day free trial', '7-day free trial'],
              ['Listings', 'Unlimited', 'Unlimited'],
              ['FEASO Reports', 'Unlimited', 'Unlimited'],
              ['IM Generation', 'Unlimited', 'Unlimited'],
              ['Compliance Review', 'Included', 'Included'],
              ['Investor Leads', 'Included', 'Included'],
              ['Cancel anytime', 'Yes', 'Yes']
            ].map((row, i) => new TableRow({
              children: row.map((cell, j) => new TableCell({
                borders: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, left: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, right: { style: BorderStyle.SINGLE, size: 1, color: BORDER } },
                shading: { fill: i % 2 === 0 ? WHITE : 'F4F6F9', type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 160, right: 160 },
                width: { size: 3120, type: WidthType.DXA },
                children: [new Paragraph({ alignment: j === 0 ? AlignmentType.LEFT : AlignmentType.CENTER, children: [new TextRun({ text: cell, font: 'Arial', size: 19, bold: j === 0, color: j === 0 ? MUTED : NAVY })] })]
              }))
            })))
          ]
        }),
        pageBreak(),

        // ════════════════════════════════════════════
        // SECTION 5 — FOR INVESTORS
        // ════════════════════════════════════════════
        label('Section 5'),
        heading1('For Wholesale Investors'),

        heading2('5.1  Who Is This For?'),
        bullet('High-net-worth individuals (net assets >$2.5M or income >$250K p.a.)'),
        bullet('Self-managed super funds with property development mandates'),
        bullet('Family offices seeking uncorrelated real asset returns'),
        bullet('Sophisticated investors with prior property development exposure'),

        spacer(80),
        goldBox([
          new Paragraph({ children: [new TextRun({ text: 'WHOLESALE INVESTOR THRESHOLD (Section 761G, Corporations Act 2001)', font: 'Arial', size: 17, bold: true, color: '8B6914', characterSpacing: 40 })], spacing: { after: 80 } }),
          new Paragraph({ children: [new TextRun({ text: 'To access deal documents on this platform you must meet at least one of: (a) net assets exceeding $2.5 million; (b) gross income exceeding $250,000 per annum in each of the last two financial years; or (c) hold a current accountant\'s certificate confirming either threshold.', font: 'Arial', size: 19, color: '5C4A1C' })] })
        ]),

        spacer(120),
        heading2('5.2  Investor Onboarding — Step by Step'),
        spacer(80),
        stepTable([
          { num: '1', title: 'Register as an Investor', desc: 'Create a free account at propdevdna.com.au. Select the Investor role.' },
          { num: '2', title: 'Complete Wholesale Verification', desc: 'Upload your accountant\'s certificate confirming you meet the Section 761G wholesale investor threshold. One-time process — certificates valid for 2 years. Approval typically within 1 business day.' },
          { num: '3', title: 'Access the Deal Room', desc: 'Once verified, browse curated development opportunities. Each listing shows: IRR, hold period, minimum investment, funding progress, and project location.' },
          { num: '4', title: 'Access the Information Memorandum', desc: 'Click "Information Memorandum" on any listing. Confirm your wholesale status and risk acknowledgments. Your confirmation is logged and timestamped. Access the full 16-page compliance-reviewed IM.' },
          { num: '5', title: 'Express Interest', desc: 'Submit an expression of interest directly through the platform — include your intended investment amount, questions, and whether you require a finance broker referral. Developer team responds within 48 hours.' },
          { num: '6', title: 'Proceed to Due Diligence', desc: 'Formal due diligence, term sheets, and legal documentation are handled directly between investor and developer (or their respective advisors). Prop Dev DNA facilitates the introduction — it does not manage or hold capital.' }
        ]),

        spacer(180),
        heading2('5.3  Investment Structures Available'),
        bullet('Equity / Joint Venture'),
        bullet('Preferred Equity (fixed return + upside participation)'),
        bullet('Private Credit / Mezzanine Finance'),
        bullet('First Mortgage (senior debt)'),

        spacer(120),
        heading2('5.4  Investor Access'),
        body('Platform access is free for all wholesale-verified investors. There are no fees for browsing, accessing documents, or expressing interest. The platform earns revenue through developer subscriptions — not investor fees.'),
        pageBreak(),

        // ════════════════════════════════════════════
        // SECTION 6 — COMPLIANCE FRAMEWORK
        // ════════════════════════════════════════════
        label('Section 6'),
        heading1('Compliance Framework'),

        heading2('6.1  AFSL Structure'),
        body('Prop Dev DNA operates as an Authorised Representative under the Australian Financial Services Licence held by DF Partners (Development Finance Partners). This arrangement provides regulatory coverage for digital facilitation of wholesale investor introductions.'),
        spacer(80),
        lightBox([
          new Paragraph({ children: [new TextRun({ text: 'AFSL Holder:   ', font: 'Arial', size: 20, bold: true, color: NAVY }), new TextRun({ text: 'DF Partners Pty Ltd', font: 'Arial', size: 20, color: '2C3E50' })], spacing: { after: 60 } }),
          new Paragraph({ children: [new TextRun({ text: 'AR Number:   ', font: 'Arial', size: 20, bold: true, color: NAVY }), new TextRun({ text: '[To be confirmed upon registration]', font: 'Arial', size: 20, color: MUTED, italics: true })], spacing: { after: 60 } }),
          new Paragraph({ children: [new TextRun({ text: 'AR Entity:   ', font: 'Arial', size: 20, bold: true, color: NAVY }), new TextRun({ text: 'Prop Dev DNA Pty Ltd', font: 'Arial', size: 20, color: '2C3E50' })] })
        ]),

        spacer(120),
        heading2('6.2  What This Means for Users'),
        heading3('For Developers'),
        body('Your IM has been reviewed by a compliance-trained team operating under a licensed financial services framework. The Compliance Review Certificate on your IM is issued under AFSL authority — this is a document you can show to lenders, investors, and legal advisors as evidence of a structured, third-party reviewed capital-raising process.'),

        heading3('For Investors'),
        body('Every introduction facilitated through this platform occurs under AFSL coverage. Your wholesale investor status is documented and verified. Every document you access carries mandatory ASIC-aligned disclosures and your acknowledgment is permanently logged.'),

        spacer(120),
        heading2('6.3  What the Platform Does Not Do'),
        bullet('Does not provide financial product advice'),
        bullet('Does not manage, hold, or invest capital on behalf of users'),
        bullet('Does not guarantee returns or project outcomes'),
        bullet('Does not conduct independent property valuations'),
        bullet('Does not act as a mortgage broker or credit provider'),

        spacer(120),
        heading2('6.4  Regulatory Basis'),
        bullet('Wholesale investor exemption: Section 761G, Corporations Act 2001 (Cth)'),
        bullet('General advice warning standard: Regulatory Guide 244 (ASIC)'),
        bullet('Platform disclosure obligations: Regulatory Guide 255 (ASIC)'),
        pageBreak(),

        // ════════════════════════════════════════════
        // SECTION 7 — TECHNOLOGY
        // ════════════════════════════════════════════
        label('Section 7'),
        heading1('Technology Platform'),

        heading2('7.1  Current Platform (Live)'),
        spacer(60),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2800, 6560],
          rows: [
            ['Deployment', 'Railway cloud platform — auto-deploy on GitHub push'],
            ['Database', 'PostgreSQL (persistent, cloud-hosted)'],
            ['Authentication', 'JWT with httpOnly cookies + bcrypt password hashing (12 rounds)'],
            ['File Storage', 'Cloudinary (documents and images with signed URLs)'],
            ['Email', 'SendGrid (transactional notifications)'],
            ['Frontend', 'Single-page application — no page reloads, instant navigation'],
            ['IM Generation', 'Client-side rendering with browser print-to-PDF'],
            ['Audit Log', 'Every significant action logged with user, IP, entity, timestamp']
          ].map((row, i) => new TableRow({
            children: [
              new TableCell({
                borders: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, left: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, right: { style: BorderStyle.SINGLE, size: 1, color: BORDER } },
                shading: { fill: 'F4F6F9', type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 140, right: 140 },
                width: { size: 2800, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: row[0], font: 'Arial', size: 19, bold: true, color: NAVY })] })]
              }),
              new TableCell({
                borders: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, left: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, right: { style: BorderStyle.SINGLE, size: 1, color: BORDER } },
                shading: { fill: i % 2 === 0 ? WHITE : 'FAFBFC', type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 140, right: 140 },
                width: { size: 6560, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: row[1], font: 'Arial', size: 19, color: '2C3E50' })] })]
              })
            ]
          }))
        }),

        spacer(180),
        heading2('7.2  Platform Roadmap (Next 6 Months)'),
        spacer(60),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [1600, 7760],
          rows: [
            ['Month 1–2', 'Stripe payment integration, wholesale verification workflow, SendGrid email notifications'],
            ['Month 3', 'Buyers Agent role, FEASO scenario comparison, IM version history'],
            ['Month 4', 'Full investor deal room with shortlisting and document vault per listing'],
            ['Month 5', 'DF Partners AR registration, platform rebranding, domain migration to propdevdna.com.au'],
            ['Month 6', 'Public launch — target 150 active developer subscriptions']
          ].map((row, i) => new TableRow({
            children: [
              new TableCell({
                borders: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, left: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, right: { style: BorderStyle.SINGLE, size: 1, color: BORDER } },
                shading: { fill: NAVY, type: ShadingType.CLEAR },
                margins: { top: 100, bottom: 100, left: 140, right: 140 },
                width: { size: 1600, type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: row[0], font: 'Arial', size: 18, bold: true, color: GOLD2 })] })]
              }),
              new TableCell({
                borders: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, left: { style: BorderStyle.SINGLE, size: 1, color: BORDER }, right: { style: BorderStyle.SINGLE, size: 1, color: BORDER } },
                shading: { fill: i % 2 === 0 ? WHITE : 'F4F6F9', type: ShadingType.CLEAR },
                margins: { top: 100, bottom: 100, left: 160, right: 160 },
                width: { size: 7760, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: row[1], font: 'Arial', size: 19, color: '2C3E50' })] })]
              })
            ]
          }))
        }),
        pageBreak(),

        // ════════════════════════════════════════════
        // SECTION 8 — FINANCIAL PROJECTIONS
        // ════════════════════════════════════════════
        label('Section 8'),
        heading1('Financial Projections'),

        heading2('8.1  Revenue Model'),
        body('Primary revenue: Developer subscriptions at $299/month per active developer.'),
        body('Secondary revenue (future): Transaction fee of 0.5–1% on capital successfully raised through the platform (subject to AFSL compliance review and legal structuring).'),

        spacer(120),
        heading2('8.2  Subscription Revenue Projections'),
        spacer(80),
        projectionTable([
          ['Month 6', '25', '$7,475', '$89,700'],
          ['Month 12', '75', '$22,425', '$269,100'],
          ['Month 18', '150', '$44,850', '$538,200'],
          ['Month 24', '300', '$89,700', '$1,076,400']
        ]),

        spacer(180),
        heading2('8.3  Key Assumptions'),
        bullet('Average developer churn: 8% per month'),
        bullet('Average customer acquisition cost: $400 (digital marketing + referral)'),
        bullet('Average subscription lifetime: 12.5 months'),
        bullet('Customer lifetime value: $3,737 per developer'),

        spacer(120),
        heading2('8.4  Cost Structure (Year 1)'),
        bullet('Cloud infrastructure (Railway): ~$200/month'),
        bullet('Email (SendGrid): ~$50/month'),
        bullet('File storage (Cloudinary): ~$30/month'),
        bullet('Payment processing (Stripe): 1.7% + $0.30 per transaction'),
        bullet('Legal — AR agreement + privacy policy: one-time ~$5,000'),
        bullet('AFSL compliance — AR fee to DF Partners: to be negotiated'),
        pageBreak(),

        // ════════════════════════════════════════════
        // SECTION 9 — MANAGEMENT
        // ════════════════════════════════════════════
        label('Section 9'),
        heading1('Management & Team'),

        heading2('9.1  Founder'),
        lightBox([
          new Paragraph({ children: [new TextRun({ text: '[Your Name]', font: 'Arial', size: 22, bold: true, color: NAVY })], spacing: { after: 60 } }),
          new Paragraph({ children: [new TextRun({ text: 'Platform Founder & Lead Developer', font: 'Arial', size: 20, color: GOLD })], spacing: { after: 80 } }),
          new Paragraph({ children: [new TextRun({ text: '[Add your background here — property development experience, technology background, prior projects]', font: 'Arial', size: 19, color: MUTED, italics: true })] })
        ]),

        spacer(120),
        heading2('9.2  Proposed Compliance Partner'),
        lightBox([
          new Paragraph({ children: [new TextRun({ text: 'Baxter Gamble', font: 'Arial', size: 22, bold: true, color: NAVY })], spacing: { after: 60 } }),
          new Paragraph({ children: [new TextRun({ text: 'Director — DF Partners / Development Finance Partners', font: 'Arial', size: 20, color: GOLD })], spacing: { after: 80 } }),
          new Paragraph({ children: [new TextRun({ text: 'Proposed Role: Responsible Manager, AFSL holder, compliance oversight for the Authorised Representative arrangement.', font: 'Arial', size: 19, color: '2C3E50' })], spacing: { after: 80 } }),
          new Paragraph({ children: [new TextRun({ text: '[Baxter\'s background to be confirmed upon partnership confirmation]', font: 'Arial', size: 19, color: MUTED, italics: true })] })
        ]),
        pageBreak(),

        // ════════════════════════════════════════════
        // SECTION 10 — HOW TO GET INVOLVED
        // ════════════════════════════════════════════
        label('Section 10'),
        heading1('How to Get Involved'),

        heading2('10.1  For Developers — Get Started Today'),
        body('Visit propdevdna.com.au and register as a developer. Activate your 7-day free trial. Build your first FEASO and generate a compliance-reviewed IM within 30 minutes. No setup fee. Cancel anytime.'),
        spacer(60),
        new Paragraph({
          children: [new ExternalHyperlink({ children: [new TextRun({ text: 'propdevdna.com.au', font: 'Arial', size: 20, bold: true, color: GOLD, underline: {} })], link: 'https://propdevdna.com.au' })]
        }),
        spacer(40),
        body('Contact: [your email]'),

        spacer(120),
        heading2('10.2  For Investors — Join the Waitlist'),
        body('Register at propdevdna.com.au as an investor. Complete wholesale verification. Get first access to compliance-checked development opportunities as the platform scales.'),
        spacer(60),
        body('Contact: [your email]'),

        spacer(120),
        heading2('10.3  For Compliance Partners — Partnership Enquiries'),
        body('If you hold an AFSL and are interested in an Authorised Representative arrangement or white-label partnership, contact us directly.'),
        spacer(60),
        body('Contact: [your email]'),
        pageBreak(),

        // ════════════════════════════════════════════
        // MANDATORY DISCLOSURES
        // ════════════════════════════════════════════
        label('Mandatory Disclosures'),
        heading1('Important Notices & Disclaimers'),
        spacer(80),
        goldBox([
          new Paragraph({ children: [new TextRun({ text: 'GENERAL ADVICE WARNING', font: 'Arial', size: 18, bold: true, color: '8B6914', characterSpacing: 80 })], spacing: { after: 80 } }),
          new Paragraph({ children: [new TextRun({ text: 'This document does not constitute financial product advice. It has been prepared without taking into account your objectives, financial situation or needs. Before acting on any information in this document, you should consider its appropriateness having regard to your own circumstances and seek independent financial advice if necessary.', font: 'Arial', size: 19, color: '5C4A1C' })], spacing: { after: 160 } }),

          new Paragraph({ children: [new TextRun({ text: 'WHOLESALE INVESTOR NOTICE', font: 'Arial', size: 18, bold: true, color: '8B6914', characterSpacing: 80 })], spacing: { after: 80 } }),
          new Paragraph({ children: [new TextRun({ text: 'This document is prepared for sophisticated and wholesale investors only, as defined under section 761G of the Corporations Act 2001 (Cth). It is not intended for retail investors.', font: 'Arial', size: 19, color: '5C4A1C' })], spacing: { after: 160 } }),

          new Paragraph({ children: [new TextRun({ text: 'FORWARD-LOOKING STATEMENTS', font: 'Arial', size: 18, bold: true, color: '8B6914', characterSpacing: 80 })], spacing: { after: 80 } }),
          new Paragraph({ children: [new TextRun({ text: 'Financial projections in this document are based on assumptions. Actual results may differ materially. No guarantee of future performance is made or implied.', font: 'Arial', size: 19, color: '5C4A1C' })], spacing: { after: 160 } }),

          new Paragraph({ children: [new TextRun({ text: 'NOT A PROSPECTUS', font: 'Arial', size: 18, bold: true, color: '8B6914', characterSpacing: 80 })], spacing: { after: 80 } }),
          new Paragraph({ children: [new TextRun({ text: 'This document is not a prospectus, product disclosure statement, or other disclosure document under the Corporations Act 2001. It has not been lodged with or approved by ASIC.', font: 'Arial', size: 19, color: '5C4A1C' })] })
        ]),
        spacer(120),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: BORDER } },
          children: [new TextRun({ text: 'Prop Dev DNA Pty Ltd   |   propdevdna.com.au   |   May 2026', font: 'Arial', size: 17, color: MUTED, italic: true })],
          spacing: { before: 120 }
        })
      ]
    }
  ]
});

// ── Write to file ───────────────────────────────────
const outputPath = path.join(__dirname, 'Prop Dev DNA — Platform Information Memorandum.docx');
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outputPath, buffer);
  console.log('SUCCESS: Document written to:', outputPath);
  console.log('File size:', Math.round(buffer.length / 1024) + ' KB');
}).catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
