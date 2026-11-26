// Public information pages: Privacy, Disclaimer, Guides, and the "Book a meeting" call to action.
// Privacy and Disclaimer wording describes how the code actually behaves — update it when that behaviour changes.
import { box, h3, muted, BOOKING_URL } from './shared.js';

const UPDATED = '26 November 2026';
const body = { fontSize: 13, color: '#333', lineHeight: 1.85, margin: '0 0 10px' };
const P = ({ children }) => <p style={body}>{children}</p>;
const List = ({ items }) => <ul style={{ ...body, paddingLeft: 20 }}>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>;
const Section = ({ title, children }) => <div style={{ marginBottom: 26 }}><h2 style={{ ...h3, fontSize: 21 }}>{title}</h2>{children}</div>;
const Mail = () => <a href="mailto:anthony@financialdnagroup.com.au" style={{ color: '#8a6d1f' }}>anthony@financialdnagroup.com.au</a>;

function Page({ label, title, sub, draft, children }) {
  return (
    <sec style={{ paddingTop: 64 }}>
      <div style={{ maxWidth: 780 }}>
        <div className="slbl">{label}</div>
        <div className="stitle" style={{ marginBottom: 8 }}>{title}</div>
        {sub && <p className="ssub" style={{ margin: '0 0 22px' }}>{sub}</p>}
        {draft && <div style={{ ...muted, padding: '10px 14px', border: '1px solid rgba(201,168,76,0.5)', background: 'rgba(201,168,76,0.08)', marginBottom: 26, color: '#444' }}>Draft for legal review · last updated {UPDATED}</div>}
        {children}
      </div>
    </sec>
  );
}

export function BookBand() {
  return (
    <div style={{ background: 'var(--ink)', padding: '40px 32px', textAlign: 'center', borderTop: '1px solid rgba(201,168,76,0.25)' }}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, color: '#fff', marginBottom: 6 }}>Talk it through first</div>
      <p style={{ fontSize: 13, color: 'rgba(245,242,236,0.6)', margin: '0 auto 20px', maxWidth: 520, lineHeight: 1.7 }}>A free 30-minute call with Anthony Lawson about your project or how the platform works.</p>
      <a className="btn btn-g" href={BOOKING_URL} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'inline-block' }}>Book a Meeting →</a>
      <div style={{ fontSize: 11, color: 'rgba(245,242,236,0.45)', marginTop: 14 }}>Or call <a href="tel:0414744516" style={{ color: 'var(--gold)' }}>0414 744 516</a> · Bookings are handled by Financial DNA Group through Calendly</div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <Page label="Privacy" title="Privacy Policy" sub="What Prop Dev DNA collects, why, who sees it, and how to ask about it." draft>
      <Section title="Who we are"><P>This site is operated by Prop Dev DNA, founded by Anthony Lawson, Sydney NSW. Contact: <Mail /> or 0414 744 516.</P></Section>
      <Section title="What we collect">
        <List items={[
          'Account details: name, email address, password (stored only as a one-way hash) and the type of account.',
          'Investor verification: date of birth, address, your accountant’s details, approximate net assets or income basis, uploaded certificates and proof-of-funds documents, education results and your chosen risk profile.',
          'Expressions of interest: contact details, indicative amount, funding source, state and any comments.',
          'Developers: project details, feasibility inputs, QS certificates, valuations, progress figures and drawdown requests.',
          'Subcontractors: business name, ABN, phone, trade, licence and insurance details, uploaded documents and stage scores.',
          'Accountants and inspectors: names, membership or licence numbers and the declarations or signatures given.',
          'Technical records: your IP address and the time of certain actions (risk acknowledgments, accountant verification and education attempts), and a sign-in cookie that lasts up to seven days.',
          'Enquiries submitted through our forms.'
        ]} />
      </Section>
      <Section title="Why we collect it"><P>To run your account, check eligibility as a wholesale client, record acknowledgments, connect investors and developers, verify contractors, send service emails and keep records of what happened and when.</P></Section>
      <Section title="Who sees it">
        <List items={[
          'Platform administrators.',
          'A developer sees your name, contact details, amount, comments and verification tier only after you confirm an expression of interest in their project.',
          'Your accountant receives your name and the basis of your certificate so they can verify it.',
          'Verified subcontractors who opt in appear in a public directory (business name, trade, state, licence class, expiry dates and score). Their contact details are shown to developers only.',
          'Milestone certificates can be viewed by anyone with the certificate link and show the project, contractor, builder and inspector names.',
          'A regulator account sees combined figures, not investor personal details.',
          'Service providers that run the platform, including hosting (Railway, which may store data outside Australia, including the United States) and an email delivery provider.'
        ]} />
        <P>We do not sell personal information.</P>
      </Section>
      <Section title="Other services your browser contacts"><P>Pages load fonts from Google Fonts and some photographs from Unsplash, so those providers receive your IP address. “Book a meeting” opens Calendly, which has its own privacy policy.</P></Section>
      <Section title="Storage and security"><P>Access is controlled by account role, passwords are hashed and uploaded documents can be downloaded only through permission-checked routes. Backup copies of platform data are kept on a rolling basis. No online service can be guaranteed secure.</P></Section>
      <Section title="Access, correction, deletion and complaints"><P>Email <Mail /> to ask for a copy of your information, to correct it or to ask for it to be deleted. Some records may need to be kept for legal reasons. If you have a privacy complaint we will respond to it. If you are not satisfied you may contact the Office of the Australian Information Commissioner (oaic.gov.au).</P></Section>
    </Page>
  );
}

export function DisclaimerPage() {
  return (
    <Page label="Legal" title="Disclaimer" sub="Please read this before relying on anything on this site." draft>
      <Section title="General information only"><P>Content on this site is general information. It is not financial product, legal, tax or credit advice and does not consider your objectives, financial situation or needs. Get independent advice before making a decision.</P></Section>
      <Section title="Not an offer"><P>Nothing here is an offer, invitation or recommendation to invest. Listings currently shown, including their figures, developers and fundraising progress, are samples for demonstration and are not open for investment.</P></Section>
      <Section title="Wholesale clients"><P>Investment features are intended only for wholesale clients under section 761G of the Corporations Act 2001 (Cth). Prop Dev DNA does not hold an Australian financial services licence.</P></Section>
      <Section title="Risk"><P>Property development is high risk. Projects can be delayed, cost more or sell for less than expected. Investments are usually illiquid and you can lose some or all of your money. Target returns are not guaranteed and past performance is not a reliable indicator of future performance.</P></Section>
      <Section title="Scores, calculators and registries"><P>Risk scores, waterfall scenarios, plain-English summaries, capital certainty figures, track record entries and contractor scores are indicative. They depend on information supplied by users and on stated assumptions, and are not independently audited. A verified label means an administrator checked a document at a point in time. It is not a recommendation or a guarantee.</P></Section>
      <Section title="Credit services"><P>Mortgage and credit services are provided separately by Financial DNA Group Pty Ltd (ABN 11 682 017 849, Authorised Credit Representative No. 565255) and Anthony Lawson (Authorised Credit Representative No. 443815), authorised credit representatives of Mortgage Australia Group Pty Ltd, Australian Credit Licence No. 377294. Those authorisations do not cover investment or financial product services.</P></Section>
      <Section title="Fees and conflicts"><P>The platform operator and related entities may receive fees or commissions connected with a project, such as listing subscriptions, success fees, broking commissions, presale commissions or co-investment returns. Ask for the details that apply before you proceed.</P></Section>
      <Section title="Contact"><P><Mail /> · 0414 744 516</P></Section>
    </Page>
  );
}

const Table = ({ head, rows }) => (
  <div style={{ overflowX: 'auto', marginBottom: 12 }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead><tr>{head.map((h, i) => <th key={h} style={{ textAlign: i ? 'right' : 'left', padding: '7px 8px', borderBottom: '1px solid rgba(0,0,0,0.25)' }}>{h}</th>)}</tr></thead>
      <tbody>{rows.map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i} style={{ textAlign: i ? 'right' : 'left', padding: '7px 8px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
);

const Guide = ({ id, title, intro, children }) => (
  <article id={id} style={{ ...box, padding: '26px 28px', marginBottom: 20, scrollMarginTop: 80 }}>
    <h2 style={{ ...h3, fontSize: 26, marginBottom: 6 }}>{title}</h2>
    <p style={{ ...body, color: 'var(--muted)' }}>{intro}</p>
    {children}
  </article>
);
const Sub = ({ children }) => <div style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#8a6d1f', margin: '16px 0 8px' }}>{children}</div>;

export function GuidesPage() {
  const jump = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  return (
    <>
      <Page label="Guides" title="Understand the deal before the numbers sell it" sub="Three short guides. The examples are made-up round figures to show the method. General information only.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
          {[['waterfalls', 'Waterfalls'], ['margins', 'Feasibility margins'], ['scoring', 'Builder scoring']].map(([id, l]) => <button key={id} className="btn btn-d btn-sm" onClick={() => jump(id)}>{l}</button>)}
        </div>

        <Guide id="waterfalls" title="How a waterfall works" intro="A waterfall is the order in which sale proceeds are paid out. Each level is paid in full before the next receives anything.">
          <Sub>Example</Sub>
          <P>A project costs $10.0m: $6.5m senior debt, $2.5m from investors and $1.0m from the developer, held for two years. Investors have a 12% a year simple preferred return ($600,000). The platform fee is 1.5% of the raise ($37,500).</P>
          <Table head={['Paid in this order', 'Sales go to plan', 'Sales fall short']} rows={[
            ['Money available after selling costs', '$12,000,000', '$8,800,000'],
            ['1. Senior lender', '$6,500,000', '$6,500,000'],
            ['2. Investor principal', '$2,500,000', '$2,300,000'],
            ['3. Investor preferred return', '$600,000', '$0'],
            ['4. Platform fee', '$37,500', '$0'],
            ['5. Developer (what is left)', '$2,362,500', '$0']
          ]} />
          <P>In the shortfall case investors lose $200,000 of principal and receive no return, even though the lender is repaid in full.</P>
          <Sub>Questions to ask</Sub>
          <List items={['Who ranks ahead of me, and for how much?', 'Is the preferred return simple or compounding, and is it guaranteed? (A preferred return sets priority. It is not a guarantee.)', 'How far can sales fall before my principal is affected?']} />
          <P>This example is simplified: it assumes lender interest and project costs are already inside the $10.0m. Real terms are in each project’s documents.</P>
        </Guide>

        <Guide id="margins" title="Feasibility margins" intro="Margin on cost measures the buffer a project has before it stops making money.">
          <Sub>Formula</Sub>
          <P><strong>Margin on cost = (gross realisable value − selling costs − total development cost) ÷ total development cost</strong></P>
          <Table head={['', 'Base case', 'Costs 5% higher']} rows={[
            ['Gross realisable value', '$12,000,000', '$12,000,000'],
            ['Selling costs (2.5%)', '$300,000', '$300,000'],
            ['Total development cost', '$10,000,000', '$10,500,000'],
            ['Profit', '$1,700,000', '$1,200,000'],
            ['Margin on cost', '17.0%', '11.4%']
          ]} />
          <P>A 5% cost rise removes almost a third of the profit and takes this project below a 15% margin.</P>
          <P>Prop Dev DNA’s feasibility builder blocks submission below 15% margin on cost, and requires a quantity surveyor’s certificate where total development cost is above $2m. Passing the minimum does not make a project safe.</P>
          <P>Check which measure is quoted. The same $1.7m profit is 17.0% on cost but 14.2% on gross realisable value.</P>
        </Guide>

        <Guide id="scoring" title="How builder stage scoring works" intro="Each project is split into six stages. The builder or developer scores the subcontractor on each stage once it is done.">
          <Sub>The six stages</Sub>
          <P>Site establishment and demolition · Slab and foundations · Frame · Lock-up · Fit-out and fixing · Practical completion and handover</P>
          <Sub>Four benchmarks, each scored 1 to 5</Sub>
          <Table head={['Benchmark', 'Example score']} rows={[['On-time delivery', '4'], ['Quality of workmanship', '5'], ['Budget adherence', '4'], ['Safety and compliance', '3'], ['Stage score (average)', '4.0']]} />
          <P>A subcontractor’s platform score is the average of their stage scores across projects.</P>
          <Sub>From score to drawdown</Sub>
          <P>A milestone certificate needs a scored stage, the builder’s sign-off and an inspector’s countersignature. A drawdown can be marked ready only when the stage is scored, the certificate is issued, the contractor’s licence and insurance are verified and current, and the feasibility is locked. The platform does not hold or move money.</P>
          <Sub>Limits</Sub>
          <P>Scores are given by the builder or developer, so they reflect that party’s judgement. Licence and insurance checks are done by an administrator, not by an automatic register feed. Platform scores cover subcontractors; builders do not yet receive their own score.</P>
        </Guide>
      </Page>
      <BookBand />
    </>
  );
}
