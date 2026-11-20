export type CategoryId =
  | 'hotel'
  | 'flight'
  | 'transfer'
  | 'car'
  | 'experience'
  | 'cruise'
  | 'rail'

export type DecisionKind = 'commit' | 'access'
export type Flexibility = 'high' | 'medium' | 'low'
export type Priority = 'High' | 'Medium' | 'Low'
export type RiskProfile = 'Conservative' | 'Balanced' | 'Growth'
export type Currency = 'INR' | 'USD'

export type ActionType =
  | 'Commit allotment'
  | 'Negotiate allotment'
  | 'Negotiate access'
  | 'Prioritise live supply'
  | 'Monitor'
  | 'Avoid'

export interface Category {
  id: CategoryId
  name: string
  short: string
  unit: string
  unitSingular: string
  decision: DecisionKind
  baseDemand: number
  avgRate: number
  costRatio: number
  ltb: number
  cancelRate: number
  growth: number
  leadDays: number
  unitsPerBooking: number
}

export interface Destination {
  id: string
  city: string
  country: string
  region: string
  weight: number
  priceIndex: number
  seasonality: number[]
}

export interface Supplier {
  id: string
  name: string
  category: CategoryId
  destinations: string[]
  tier: 'Premium' | 'Standard' | 'Value'
  reliability: number
  failureRate: number
  flexibility: Flexibility
  avgRate: number
  responseHours: number
  lastUpdated: string
  rateHistory: { month: string; rate: number }[]
}

export interface WeeklyPoint {
  weekStart: string
  category: CategoryId
  destinationId: string
  searches: number
  soldouts: number
  bookings: number
  cancellations: number
  revenue: number
  cost: number
}

export interface SupplierQuote {
  supplierId: string
  rate: number
  capacity: number
  reliability: number
  flexibility: Flexibility
  releaseDays: number
}

export interface ScoreBreakdown {
  gap: number
  growth: number
  conversion: number
  margin: number
  reliability: number
  resilience: number
  certainty: number
}

export type OpportunityInput = Omit<Opportunity, 'score' | 'scoreBreakdown' | 'priority' | 'action' | 'rationale'>

export interface Opportunity {
  id: string
  category: CategoryId
  destinationId: string
  weekStart: string
  weeksOut: number
  forecast: number
  forecastLow: number
  forecastHigh: number
  reliableSupply: number
  gap: number
  ltb: number
  soldoutRate: number
  demandGrowth: number
  cancellationRisk: number
  confidence: number
  sellPrice: number
  bestUnitCost: number
  contributionPerUnit: number
  quotes: SupplierQuote[]
  score: number
  scoreBreakdown: ScoreBreakdown
  priority: Priority
  action: ActionType
  eventLabel?: string
  rationale: string[]
}

export interface PlanConfig {
  budget: number
  currency: Currency
  horizonWeeks: number
  categories: CategoryId[]
  reservePct: number
  supplierCapPct: number
  risk: RiskProfile
  categoryCaps: Partial<Record<CategoryId, number>>
}

export type Tranche = 1 | 2 | 3

export interface AllocationLine {
  opportunityId: string
  supplierId: string
  quantity: number
  unitCost: number
  totalCost: number
  expectedContribution: number
  downsideExposure: number
  sellProbability: number
  tranches: Tranche[]
}

export interface CategoryAllocation {
  category: CategoryId
  allocated: number
  contribution: number
  downside: number
  units: number
}

export interface AccessRecommendation {
  opportunityId: string
  supplierId: string
  action: ActionType
  reason: string
}

export interface OptimizerResult {
  lines: AllocationLine[]
  access: AccessRecommendation[]
  allocated: number
  reserve: number
  unallocated: number
  expectedContribution: number
  downside: number
  byCategory: CategoryAllocation[]
  accessBudget: number
  fillRate: number
}

export type DecisionStatus = 'Pending' | 'Approved' | 'Rejected' | 'Monitoring' | 'Completed'

export interface Decision {
  status: DecisionStatus
  note?: string
  user?: string
  userRole?: Profile['role']
  at?: string
  previousHash?: string
  hash?: string
}

export interface Recommendation {
  id: string
  kind: 'commitment' | 'access'
  opportunityId: string
  supplierId: string
  quantity: number
  unitCost: number
  totalCost: number
  expectedContribution: number
  downsideExposure: number
  action: ActionType
  confidence: number
  score: number
  tranches: Tranche[]
  status: DecisionStatus
  note?: string
  decidedBy?: string
  decidedAt?: string
  realised?: {
    sold: number
    revenue: number
    profit: number
    unsold: number
  }
}

export interface Profile {
  name: string
  role: 'Inventory Analyst' | 'Approver' | 'Admin'
}

export interface Dataset {
  generatedAt: string
  seedLabel: string
  destinations: Destination[]
  suppliers: Supplier[]
  history: WeeklyPoint[]
  opportunities: Opportunity[]
}

export interface ImportSummary {
  fileName: string
  rows: number
  accepted: number
  rejected: number
  errors: string[]
}

export interface Toast {
  id: string
  title: string
  description?: string
  tone: 'success' | 'error' | 'info'
}
