"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { H3 } from "@/components/ui/Heading";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { AlertCircle, CheckCircle2, Info, LineChart, Shield } from "lucide-react";

const TAB_ITEMS = [
  { value: "plan", label: "Plan & Commissions" },
  { value: "legal", label: "Legal Disclaimers" },
  { value: "affiliate", label: "Affiliate Code" },
  { value: "terms", label: "User Terms" },
] as const;

type TabValue = (typeof TAB_ITEMS)[number]["value"];

export default function PlanRulesPage() {
  const [tab, setTab] = useState<TabValue>("plan");

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 text-purple-700 px-3 py-1 text-xs font-semibold">
          <Info className="w-3 h-3" />
          <span>Understanding your plan, earnings &amp; policies</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              Plan Rules &amp; Commission Structure
            </h1>
            <p className="text-sm md:text-base text-gray-200 max-w-3xl">
              This page explains how your plan works – when each rule applies, which commission
              types are available, and the key legal policies that protect both you and the company.
            </p>
          </div>
          <Tabs value={tab} onChange={(v) => setTab(v as TabValue)} items={[...TAB_ITEMS]} size="sm" />
        </div>
      </header>

      {tab === "plan" && (
        <Card className="p-8 md:p-10 flex flex-col items-center justify-center gap-4 text-center">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-200 text-xs font-semibold">
            <LineChart className="w-4 h-4" />
            <span>Plan &amp; Commission details</span>
          </div>
          <h2 className="text-xl md:text-2xl font-semibold text-white">
            Plan &amp; Commission breakdown coming soon
          </h2>
          <p className="text-sm md:text-base text-gray-300 max-w-2xl">
            A detailed visual explanation of all commission types, qualification rules, and
            examples is under preparation. For now, please use the other tabs for legal, affiliate,
            and user terms, or contact Support if you need any clarification about your earnings
            plan.
          </p>
        </Card>
      )}

      {tab === "legal" && (
        <>
          <Card className="p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <H3 className="text-lg font-semibold">
                Software End-User Agreement &amp; Legal Disclaimer
              </H3>
              <Badge tone="amber" size="sm">
                Important
              </Badge>
            </div>
            <div className="space-y-3 text-sm text-gray-100">
              <p>
                <span className="font-semibold">1. Nature of Business &amp; Platform Use:</span>{" "}
                Welcome to the Secure Infinite Association platform. By accessing this software, you
                acknowledge that this platform is strictly designed for direct selling, e-commerce,
                and the management of product purchases (including FMCG, Pharma, and Agro products).
                This platform is <span className="font-semibold">NOT</span> an investment portal,
                financial scheme, or a public deposit collection system.
              </p>
              <p>
                <span className="font-semibold">2. No Guaranteed Returns or “ROI”:</span> The
                company strictly prohibits and does not offer any fixed monthly returns, interest
                payouts, or “money doubling” schemes. Any commissions, incentives, or bonuses
                displayed in this software are strictly generated through the active sales of
                company products and are subject to the official compensation plan, including all
                applicable system caps and limits.
              </p>
              <p>
                <span className="font-semibold">3. Product Purchase Acknowledgement:</span> Any
                funds transferred to the company are exclusively for the purchase of products,
                goods, or services, or as a standard business advance for such purchases. You
                confirm that you are not depositing funds as a loan or financial investment.
              </p>
              <p>
                <span className="font-semibold">4. Prohibition of Misrepresentation:</span>{" "}
                Independent distributors, leaders, and users are strictly forbidden from
                misrepresenting the company’s business model. Promoting the company&apos;s product
                packages as “investments” or promising guaranteed financial returns to third parties
                is a direct violation of company policy and will result in immediate termination of
                the user account and potential legal action.
              </p>
              <p>
                <span className="font-semibold">5. Risk &amp; Liability:</span> Success in this
                business depends entirely on individual effort, sales volume, and market conditions.
                The company holds no liability for any unauthorized financial promises made by
                independent agents or third parties outside of the official, published company
                materials.
              </p>
              <p>
                <span className="font-semibold">6. Jurisdiction:</span> By continuing to use this
                software, you agree to these terms. All legal disputes shall be subject to the
                exclusive jurisdiction of the competent courts in Desaiganj.
              </p>
              <p className="italic text-gray-200">
                “Empowering India through Innovation &amp; Integrity.”
              </p>
            </div>
          </Card>

          <Card className="p-5 md:p-6 space-y-3 bg-amber-900/40 border-amber-500/70">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-amber-300" />
              <H3 className="text-base font-semibold text-amber-50">
                Important notes &amp; general disclaimer
              </H3>
            </div>
            <ul className="list-disc pl-5 text-sm text-amber-50 space-y-1">
              <li>
                Ye page educational overview ke liye hai – final calculation hamesha live system,
                wallet &amp; official policy ke hisaab se hoti hai.
              </li>
              <li>
                Sabhi incomes business performance, cash flow, compliance checks aur risk management
                policies ke under aati hain.
              </li>
              <li>
                Fixed / guaranteed return ka koi promise nahi hai – system market linked hai, profit
                bhi ho sakta hai aur loss ka risk bhi rahta hai.
              </li>
              <li>
                Agar aapko kisi rule / commission / policy ke baare me doubt ho to{" "}
                <span className="font-semibold">Support</span> section me ticket raise kar sakte
                hain – team aapko detail me guide karegi.
              </li>
            </ul>
          </Card>
        </>
      )}

      {tab === "affiliate" && (
        <Card className="p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <H3 className="text-lg font-semibold">
              Affiliate Agent Agreement &amp; Code of Conduct
            </H3>
            <Badge tone="red" size="sm">
              Strict Policy
            </Badge>
          </div>
          <div className="space-y-4 text-sm text-gray-100">
            <p>
              This agreement is binding for all individuals registered as{" "}
              <span className="font-semibold">&quot;Affiliate Agents&quot; or &quot;Direct Sellers&quot;</span>{" "}
              with Secure Infinite Association. By accessing the system, the Agent agrees to the
              following strictly enforced terms:
            </p>

            <div>
              <p className="font-semibold mb-1">
                1. Nature of Relationship &amp; Business Model
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-semibold">Performance‑Based Pay:</span> The Agent
                  acknowledges that they will receive compensation strictly for successful affiliate
                  sales of products / services or verified referrals as defined by the Company.
                </li>
                <li>
                  <span className="font-semibold">Legal Direct Selling Model:</span> The Company does
                  not operate a Multi‑Level Marketing (MLM) Pyramid Scheme. No commissions are paid
                  for the mere act of recruiting others; earnings are generated solely through
                  product / service value exchange and professional marketing.
                </li>
              </ul>
            </div>

            <div>
              <p className="font-semibold mb-1">
                2. Strict Prohibition of &quot;Investment&quot; &amp; &quot;Stamp Paper&quot;
                Promises (CRITICAL)
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-semibold">No Investment Claims:</span> Agents are strictly
                  forbidden from promoting the Company&apos;s product packages as an{" "}
                  <span className="font-semibold">&quot;Investment&quot;</span> or promising any{" "}
                  <span className="font-semibold">
                    &quot;Fixed Monthly Return&quot; or &quot;Double Money&quot;
                  </span>{" "}
                  schemes.
                </li>
                <li>
                  <span className="font-semibold">Ban on Stamp Paper / Notary Agreements:</span>{" "}
                  Agents must never execute any stamp paper, notary, or legal agreements with
                  customers guaranteeing financial returns. The Company assumes zero liability for
                  such illegal acts.
                </li>
                <li>
                  <span className="font-semibold">Personal Responsibility:</span> Any Agent using
                  their own words to provide guarantees not found in the official Company literature
                  does so at their own absolute legal and financial risk. The Company will not defend
                  or compensate for such unauthorized actions.
                </li>
              </ul>
            </div>

            <div>
              <p className="font-semibold mb-1">3. Mandatory Identification (ID Cards)</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Every Agent must possess and carry an{" "}
                  <span className="font-semibold">Official Company ID Card</span>.
                </li>
                <li>
                  It is compulsory to present this ID during any business‑related interaction.
                  Representing the Company without a valid, system‑generated ID is strictly
                  prohibited and may lead to immediate termination.
                </li>
              </ul>
            </div>

            <div>
              <p className="font-semibold mb-1">4. Authority of Management &amp; System Limits</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-semibold">Binding Decisions:</span> All decisions made by the
                  CMD, Management, and the Leadership Committee after official meetings are final and
                  mandatory for all Agents.
                </li>
                <li>
                  <span className="font-semibold">System Caps &amp; Limits:</span> Agents must
                  strictly respect all software‑enforced earning limits, capping rules, and payout
                  conditions without dispute.
                </li>
                <li>
                  <span className="font-semibold">Compliance:</span> Refusal to follow the directives
                  of the Leadership Committee will be considered a breach of contract.
                </li>
              </ul>
            </div>

            <div>
              <p className="font-semibold mb-1">5. Right to Amend Rules &amp; Commissions</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  The Company reserves the absolute right to modify, add, or delete any rules, terms,
                  or the Affiliate Commission Structure at any time without prior individual consent,
                  in order to ensure business sustainability and legal compliance.
                </li>
              </ul>
            </div>

            <div>
              <p className="font-semibold mb-1">6. Legal &amp; Government Compliance</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  All Agents must strictly adhere to the laws of the Government of India, including
                  Consumer Protection (Direct Selling) Rules and applicable Tax Guidelines.
                </li>
                <li>
                  Any change in government policy that affects the business model must be accepted by
                  the Agent immediately.
                </li>
              </ul>
            </div>

            <div>
              <p className="font-semibold mb-1">7. Fraud &amp; Scam Prevention (Account Blocking)</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Any Agent found involved in any scam, fraudulent activity, or unethical behavior
                  will have their ID permanently blocked without notice.
                </li>
                <li>
                  In such cases, all pending commissions will be forfeited, and the Company may
                  initiate criminal proceedings if necessary.
                </li>
              </ul>
            </div>

            <div>
              <p className="font-semibold mb-1">
                10 Additional Strict Clauses for Agent Safety &amp; Company Protection
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-semibold">Independent Contractor Status:</span> Agents are
                  independent partners and are not employees of the Company. They are responsible for
                  their own local taxes and expenses.
                </li>
                <li>
                  <span className="font-semibold">No Guarantee of Profit:</span> The Agent understands
                  that joining does not guarantee income. Success depends entirely on the Agent&apos;s
                  marketing skills and effort.
                </li>
                <li>
                  <span className="font-semibold">Anti‑Poaching Policy:</span> Any Agent found trying
                  to shift existing members to other companies or engaging in cross‑lining within the
                  system will be terminated immediately.
                </li>
                <li>
                  <span className="font-semibold">Truth in Advertising:</span> All marketing must be
                  realistic and modern. Exaggerating product benefits or showing fake income
                  screenshots is strictly banned.
                </li>
                <li>
                  <span className="font-semibold">Digital Decorum:</span> Agents must maintain
                  professional behaviour on WhatsApp groups and social media. Using abusive language
                  against the management or other leaders is a terminable offence.
                </li>
                <li>
                  <span className="font-semibold">Data Privacy:</span> Agents must not share user
                  database information, Aadhaar details, or phone numbers of other members with third
                  parties.
                </li>
                <li>
                  <span className="font-semibold">Training Attendance:</span> To remain an active
                  Agent, participation in official training sessions or webinars conducted by the
                  Management is highly recommended.
                </li>
                <li>
                  <span className="font-semibold">Strict No‑Cash Policy:</span> Agents are strictly
                  forbidden from collecting cash from users. All payments must be directed to the
                  Company&apos;s official digital bank accounts.
                </li>
                <li>
                  <span className="font-semibold">Cooling‑off Period:</span> All new affiliates have
                  the right to a{" "}
                  <span className="font-semibold">&quot;cooling‑off&quot; period</span> as per
                  government norms to understand the terms before proceeding with active marketing.
                </li>
              </ul>
            </div>

            <p className="text-xs text-gray-300">
              Final Note: This document ensures that the burden of proof and responsibility lies
              purely with the Agent, keeping the Company and Management legally secure.
            </p>
          </div>
        </Card>
      )}

      {tab === "terms" && (
        <Card className="p-5 md:p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <H3 className="text-lg font-semibold">
              User Terms &amp; Conditions (Participant Agreement)
            </H3>
            <Badge tone="blue" size="sm">
              User Agreement
            </Badge>
          </div>
          <div className="space-y-6 text-sm text-gray-100">
            <p>
              This document is a legally binding agreement between the{" "}
              <span className="font-semibold">Participant / Affiliate</span> and{" "}
              <span className="font-semibold">Secure Infinite Association</span>. By registering on
              the platform, you confirm that you have{" "}
              <span className="font-semibold">read, understood, and accepted</span> these terms.
            </p>

            <div>
              <p className="font-semibold mb-1">1. Eligibility &amp; Single Identity Policy</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-semibold">Age Requirement:</span> The User must be at least{" "}
                  <span className="font-semibold">18 years old</span> and legally competent under the
                  Indian Contract Act, 1872.
                </li>
                <li>
                  <span className="font-semibold">One ID Rule:</span> Each individual may create only{" "}
                  <span className="font-semibold">one ID</span> with valid Aadhaar and PAN. Using
                  multiple IDs or fake / duplicate documents may result in a permanent ban on all
                  related accounts.
                </li>
              </ul>
            </div>

            <div>
              <p className="font-semibold mb-1">2. Mandatory KYC Verification</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Before any affiliate commission is released,{" "}
                  <span className="font-semibold">KYC (Know Your Customer)</span> must be fully
                  completed.
                </li>
                <li>
                  The User must provide valid government documents – Aadhaar Card, PAN Card, bank
                  account details, etc.
                </li>
                <li>
                  If fake or invalid documents are detected,{" "}
                  <span className="font-semibold">withdrawal rights may be suspended</span>.
                </li>
              </ul>
            </div>

            <div>
              <p className="font-semibold mb-1">3. No Investment &amp; No Fixed Returns Policy</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-semibold">Not an Investment Scheme:</span> Secure Infinite
                  Association is an{" "}
                  <span className="font-semibold">
                    affiliate marketing and services platform
                  </span>
                  , not a Ponzi scheme, chit fund, or multi‑level investment company.
                </li>
                <li>
                  <span className="font-semibold">No Fixed Returns:</span> The Company never promises{" "}
                  <span className="font-semibold">
                    &quot;fixed return&quot;, &quot;monthly interest&quot;, or &quot;guaranteed
                    passive profit&quot;
                  </span>
                  . Earnings are always performance‑based and arise from actual product sales and
                  professional affiliate marketing.
                </li>
              </ul>
            </div>

            <div>
              <p className="font-semibold mb-1">4. Revenue Structure, TDS &amp; Admin Charges</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-semibold">Tax Compliance:</span> All affiliate commissions
                  are subject to{" "}
                  <span className="font-semibold">TDS (Tax Deducted at Source)</span> as per the
                  prevailing rules of the Income Tax Department.
                </li>
                <li>
                  <span className="font-semibold">Service &amp; Admin Fees:</span> A{" "}
                  <span className="font-semibold">10% Admin Charge</span> may be deducted from each
                  payout to cover software maintenance, platform management, and operational costs,
                  aligned with global e‑commerce standards.
                </li>
              </ul>
            </div>

            <div>
              <p className="font-semibold mb-1">5. Zero Cash Transaction Policy</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  All financial dealings with the Company must take place only through{" "}
                  <span className="font-semibold">digital channels</span> (UPI, Net Banking, payment
                  gateways, etc.).
                </li>
                <li>
                  The Company <span className="font-semibold">does not accept cash</span>. If any
                  user gives cash to an Agent, it is{" "}
                  <span className="font-semibold">purely at the risk of the user and the agent</span>
                  ; the Company will not be responsible.
                </li>
              </ul>
            </div>

            <div>
              <p className="font-semibold mb-1">6. Disclaimer for Third‑Party Misrepresentation</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  The Company is not responsible for any third‑party fake promise, &quot;get‑rich‑quick&quot;
                  claim, or unauthorized PDFs / videos.
                </li>
                <li>
                  Users should rely only on the{" "}
                  <span className="font-semibold">official website and verified documents</span>.
                  Agents / users found guilty of misrepresentation may face legal action and
                  termination.
                </li>
              </ul>
            </div>

            <div>
              <p className="font-semibold mb-1">Strict Legal Clauses for Company Protection</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-semibold">Skill‑Based Compensation:</span> Income arises only
                  from successful product / service sales and marketing; there is no income based
                  purely on recruitment or registrations.
                </li>
                <li>
                  <span className="font-semibold">Right to Amendment:</span> The Company may update
                  the business plan, commission structure, or terms at any time to remain compliant
                  with changing regulations and management decisions.
                </li>
                <li>
                  <span className="font-semibold">Anti‑Spam &amp; Ethical Conduct:</span> Spam,
                  misleading financial claims, or unethical marketing (especially on social media) is
                  strictly prohibited.
                </li>
                <li>
                  <span className="font-semibold">No Guarantee of Results:</span> The past
                  performance of other affiliates does not guarantee your future results. Earnings
                  depend entirely on your effort and market conditions.
                </li>
                <li>
                  <span className="font-semibold">Termination for Defamation:</span> Any user who
                  engages in negative marketing, fake news, or defamation of the brand may have
                  their ID terminated without notice.
                </li>
                <li>
                  <span className="font-semibold">Intellectual Property Rights:</span> All logos,
                  trademarks, training material, and content are the property of the Company; any
                  unauthorized editing or commercial use is prohibited.
                </li>
                <li>
                  <span className="font-semibold">Ethical Standards:</span> Fraud, cross‑lining
                  (poaching members), or any unethical activity may result in account suspension or
                  permanent ban.
                </li>
                <li>
                  <span className="font-semibold">Dispute Resolution &amp; Jurisdiction:</span> For
                  any legal dispute, jurisdiction will lie only with the courts of the{" "}
                  <span className="font-semibold">city where the Company&apos;s Registered Office</span>{" "}
                  is located.
                </li>
                <li>
                  <span className="font-semibold">Force Majeure:</span> The Company will not be
                  liable for delays or failures caused by Acts of God, government restrictions, or
                  unforeseen technical outages.
                </li>
                <li>
                  <span className="font-semibold">Finality of Decision:</span> Decisions of the CMD
                  and Leadership Committee are final and binding; their interpretation of the rules
                  will be treated as the last authority.
                </li>
              </ul>
            </div>

            {/* Extra: User Terms of Service & Financial Agreement */}
            <div className="pt-4 border-t border-white/10 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <H3 className="text-base font-semibold">
                  User Terms of Service &amp; Financial Agreement
                </H3>
                <Badge tone="purple" size="sm">
                  Loan &amp; Course Terms
                </Badge>
              </div>
              <p>
                Ye section un users ke liye hai jo course purchase karte hain, affiliate program join
                karte hain ya mutual business loan agreement me enter karte hain. In points ka purpose
                expectations clear rakhna aur company ko legally compliant rakhna hai.
              </p>

              <div>
                <p className="font-semibold mb-1">1. Non‑Refundable Course / Product Fee</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <span className="font-semibold">Strict No‑Refund Policy:</span> Once digital
                    course / service purchase ho jaata hai, payment{" "}
                    <span className="font-semibold">100% non‑refundable</span> hai. Lack of interest,
                    dissatisfaction, ya personal reason ke base par refund nahi milega.
                  </li>
                  <li>
                    <span className="font-semibold">Income Opportunity:</span> Agar User earning
                    karna chahta hai to wo voluntarily affiliate program join kar sakta hai. Course
                    purchase sirf learning ke liye hai – income kabhi guaranteed nahi hoti, wo sirf
                    affiliate performance par depend karti hai.
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-semibold mb-1">2. Emergency &amp; Financial Assistance Disclaimer</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Company ek business entity hai, welfare trust ya insurance organization nahi.
                  </li>
                  <li>
                    Personal emergency, medical issue, ya urgent financial need ke case me company
                    koi separate financial help / refund provide karne ke liye legally bound nahi hai.
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-semibold mb-1">
                  3. Mutual Business Loan &amp; Repayment Structure
                </p>
                <p className="mb-1">
                  Agar koi User mutual understanding ke basis par Company ko{" "}
                  <span className="font-semibold">Business Loan</span> provide karta hai, to ye rules
                  apply honge:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <span className="font-semibold">Utilization of Funds:</span> Company ko full
                    right hai ki loan amount ko business operations, expansion ya investments me use
                    kare.
                  </li>
                  <li>
                    <span className="font-semibold">Monthly Installment Repayment:</span> Principal +
                    Interest kabhi bhi ek hi baar lump sum me repay nahi kiya jayega; repayment
                    hamesha{" "}
                    <span className="font-semibold">monthly installments (30th of every month)</span>{" "}
                    ke through hoga.
                  </li>
                  <li>
                    <span className="font-semibold">Duration &amp; Caps:</span>
                    <ul className="list-disc pl-5 space-y-1 mt-1">
                      <li>
                        <span className="font-semibold">60‑Month Plan:</span> Total maximum interest /
                        benefit cap = <span className="font-semibold">100% over 60 months</span>.
                      </li>
                      <li>
                        <span className="font-semibold">30‑Month Plan:</span> Total maximum interest /
                        benefit cap = <span className="font-semibold">50% over 30 months</span>.
                      </li>
                    </ul>
                  </li>
                  <li>
                    <span className="font-semibold">No Premature Withdrawal:</span> User tenure
                    complete hone se pehle full amount wapas demand nahi kar sakta (na 60‑month plan
                    me, na 30‑month plan me).
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-semibold mb-1">4. No Fixed Returns or Guaranteed Profits</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Company "Fixed Returns", "Doubling Money" ya guaranteed profit ka promise nahi
                    karti. Payouts sirf mutual loan agreement ke rules &amp; company policy ke mutabik
                    hote hain.
                  </li>
                  <li>
                    Company kisi bhi tarah ki "get‑rich‑quick" marketing ko discourage karti hai aur
                    promote nahi karti.
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-semibold mb-1">5. Zero Liability for Agent Misconduct</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Agar User kisi Agent ke{" "}
                    <span className="font-semibold">fake promise</span> ya{" "}
                    <span className="font-semibold">unofficial PDF / message</span> ke basis par join
                    karta hai, to company uske liye responsible nahi hogi.
                  </li>
                  <li>
                    User ki responsibility hai ki wo ye official terms padhe. Jo bhi verbal /
                    written commitment in terms ke against hai, wo{" "}
                    <span className="font-semibold">null &amp; void</span> maana jayega.
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-semibold mb-1">
                  Additional Strict Legal Clauses (Financial &amp; Loan Safety)
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <span className="font-semibold">Strict Adherence to Official Rules:</span> Loan
                    provide karne ke baad sirf{" "}
                    <span className="font-semibold">official Terms &amp; Conditions</span> applicable
                    honge; purani personal conversations ya external docs consider nahi kiye jayenge.
                  </li>
                  <li>
                    <span className="font-semibold">Right to Withhold Payouts:</span> Policy violation
                    ya suspicious activity detect hone par company investigation complete hone tak{" "}
                    <span className="font-semibold">monthly repayments hold / freeze</span> kar
                    sakti hai.
                  </li>
                  <li>
                    <span className="font-semibold">No Loan‑on‑Loan:</span> User apne pending
                    installments ko system ke andar collateral ya "loan against loan" ke roop me use
                    nahi kar sakta.
                  </li>
                  <li>
                    <span className="font-semibold">Transaction Fees:</span> Saare monthly repayments
                    par applicable bank charges, gateway fees aur standard{" "}
                    <span className="font-semibold">10% Admin Fee</span> lag sakta hai.
                  </li>
                  <li>
                    <span className="font-semibold">One User, One Account:</span> Loan system ko
                    exploit karne ke liye multiple accounts banane par sabhi funds permanently freeze
                    kiye ja sakte hain.
                  </li>
                  <li>
                    <span className="font-semibold">Discretionary Changes:</span> Market conditions
                    ya government regulations ke basis par company{" "}
                    <span className="font-semibold">
                      interest slabs ya repayment dates change
                    </span>{" "}
                    karne ka right rakhti hai.
                  </li>
                  <li>
                    <span className="font-semibold">Anti‑Defamation Clause:</span> Agar koi User
                    repayment schedule ko lekar social media par negative / defamatory content post
                    karta hai, to agreement terminate kiya ja sakta hai aur legal action ho sakta
                    hai.
                  </li>
                  <li>
                    <span className="font-semibold">Digital Signature:</span> "I Agree" click karna
                    ya payment karna ek{" "}
                    <span className="font-semibold">digital signature</span> maana jayega ki User ne
                    "No Refund" aur "Monthly Installment" clauses samajh kar accept kiye hain.
                  </li>
                  <li>
                    <span className="font-semibold">No Cash Dealings:</span> Company sirf official
                    bank channels se aane wale payments ko recognize karti hai. Kisi third party ko
                    cash dena, company ke loan ke naam par, recognize nahi kiya jayega.
                  </li>
                  <li>
                    <span className="font-semibold">Jurisdiction (Loan / Affiliate Disputes):</span>{" "}
                    Loan ya affiliate agreement se related sabhi disputes{" "}
                    <span className="font-semibold">
                      company ke head office ke city ke arbitration / courts
                    </span>{" "}
                    ke jurisdiction me aayenge.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

