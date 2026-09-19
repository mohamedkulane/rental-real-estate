import type { TermDefinition, TermKey } from './types';

export const terminologyDictionary: Record<TermKey, TermDefinition> = {
  property: {
    english: 'Property',
    somali: 'Hanti / Property',
    descriptionSomali:
      'Hantida sharci iyo muuqaal ahaan la diiwaangeliyey, sida guri, dhul ama dhisme.',
    context: 'portfolio',
  },
  propertyType: {
    english: 'Property Type',
    somali: 'Nooca hantida',
    context: 'portfolio',
  },
  owner: {
    english: 'Owner',
    somali: 'Milkiile',
    descriptionSomali: 'Milkiilaha property-ga.',
    context: 'portfolio',
  },
  ownership: {
    english: 'Ownership',
    somali: 'Lahaansho',
    descriptionSomali: 'Dooro qofka ama dadka leh property-ga iyo saamiga qof walba.',
    context: 'portfolio',
  },
  ownershipShare: {
    english: 'Ownership Share',
    somali: 'Saamiga lahaanshaha',
    descriptionSomali: 'Boqolkiiba saamiga uu milkiilahani leeyahay.',
    context: 'portfolio',
  },
  building: {
    english: 'Building',
    somali: 'Dhisme',
    context: 'portfolio',
  },
  structure: {
    english: 'Structure',
    somali: 'Qaab-dhismeed',
    context: 'portfolio',
  },
  rentableSpace: {
    english: 'Rentable Space',
    somali: 'Meel si gaar ah loo kireyn karo',
    descriptionSomali:
      'Qaybta property-ga ee si madax-bannaan loo kireyn karo sida apartment, shop ama office.',
    context: 'portfolio',
  },
  occupancy: {
    english: 'Occupancy',
    somali: 'Deganaansho / Isticmaal',
    descriptionSomali: 'Xaaladda deggenaanshaha ama isticmaalka space-ka.',
    context: 'leasing',
  },
  vacant: {
    english: 'Vacant',
    somali: 'Bannaan',
    context: 'leasing',
  },
  occupied: {
    english: 'Occupied',
    somali: 'La degan yahay / La isticmaalayo',
    context: 'leasing',
  },
  tenant: {
    english: 'Tenant',
    somali: 'Kirayste',
    context: 'leasing',
  },
  lease: {
    english: 'Lease',
    somali: 'Heshiiska kirada',
    context: 'leasing',
  },
  leaseContract: {
    english: 'Lease Contract',
    somali: 'Qandaraaska kirada',
    context: 'leasing',
  },
  moveIn: {
    english: 'Move-In',
    somali: 'Gelitaanka kiraystaha',
    context: 'leasing',
  },
  renewal: {
    english: 'Renewal',
    somali: 'Cusboonaysiinta heshiiska',
    context: 'leasing',
  },
  reservation: {
    english: 'Reservation',
    somali: 'Qabasho ku-meel-gaar ah',
    context: 'leasing',
  },
  application: {
    english: 'Application',
    somali: 'Codsiga kirada',
    context: 'leasing',
  },
  viewing: {
    english: 'Viewing',
    somali: 'Booqashada property-ga',
    context: 'leasing',
  },
  listing: {
    english: 'Listing',
    somali: 'Xayeysiiska property-ga',
    context: 'leasing',
  },
  rentalListing: {
    english: 'Rental Listing',
    somali: 'Xayeysiiska kirada',
    descriptionSomali: 'Diiwaanka xayeysiinta ee property-ga kirada loo dhigayo.',
    context: 'leasing',
  },
  rentalBrokerage: {
    english: 'Rental Brokerage',
    somali: 'Dilaalinta kirada',
    descriptionSomali:
      'Shirkaddu waxay heshaa kirayste waxaana ay qaadataa commission hal mar ah.',
    context: 'commercial',
  },
  fullManagement: {
    english: 'Full Management',
    somali: 'Maamulka buuxa ee property-ga',
    descriptionSomali:
      'Shirkaddu si joogto ah ayay u maamushaa property-ga, kiraystaha, billing-ka iyo adeegyada kale.',
    context: 'commercial',
  },
  saleBrokerage: {
    english: 'Sale Brokerage',
    somali: 'Dilaalinta iibka',
    descriptionSomali:
      'Shirkaddu waxay property-ga milkiilaha u raadisaa iibsade iyadoo commission qaadanaysa.',
    context: 'commercial',
  },
  serviceEngagement: {
    english: 'Service Engagement',
    somali: 'Heshiiska adeegga',
    descriptionSomali:
      'Waxa uu qeexayaa adeegga shirkaddu property-ga ka qaban karto iyo muddada uu shaqeynayo.',
    context: 'commercial',
  },
  capability: {
    english: 'Capability',
    somali: 'Awoodda adeegga',
    context: 'commercial',
  },
  lead: {
    english: 'Lead',
    somali: 'Macmiil suurtagal ah',
    context: 'crm',
  },
  pipeline: {
    english: 'Pipeline',
    somali: 'Marxaladaha macmiilka',
    context: 'crm',
  },
  followUp: {
    english: 'Follow-Up',
    somali: 'La-socod',
    context: 'crm',
  },
  leadSource: {
    english: 'Lead Source',
    somali: 'Meesha uu macmiilku ka yimid',
    context: 'crm',
  },
  assignedAgent: {
    english: 'Assigned Agent',
    somali: 'Shaqaalaha loo xilsaaray',
    context: 'crm',
  },
  leadNew: {
    english: 'New',
    somali: 'Cusub',
    context: 'crm',
  },
  leadContacted: {
    english: 'Contacted',
    somali: 'La lala xiriiray',
    context: 'crm',
  },
  leadQualified: {
    english: 'Qualified',
    somali: 'Ku habboon / La xaqiijiyey',
    context: 'crm',
  },
  leadMatching: {
    english: 'Matching',
    somali: 'Property ku habboon ayaa loo raadinayaa',
    context: 'crm',
  },
  leadNurturing: {
    english: 'Nurturing',
    somali: 'Weli lala socdo',
    context: 'crm',
  },
  leadConverted: {
    english: 'Converted',
    somali: 'Macmiil noqday',
    context: 'crm',
  },
  leadLost: {
    english: 'Lost',
    somali: 'Lumay / Ma sii socdo',
    context: 'crm',
  },
  invoice: {
    english: 'Invoice',
    somali: 'Qaansheeg / Lacag-bixin la dalbaday',
    context: 'finance',
  },
  payment: {
    english: 'Payment',
    somali: 'Lacag-bixin',
    context: 'finance',
  },
  receipt: {
    english: 'Receipt',
    somali: 'Rasiid',
    context: 'finance',
  },
  outstandingBalance: {
    english: 'Outstanding Balance',
    somali: 'Lacagta harsan',
    context: 'finance',
  },
  charge: {
    english: 'Charge',
    somali: 'Kharash lagu leeyahay',
    context: 'finance',
  },
  expense: {
    english: 'Expense',
    somali: 'Kharash',
    context: 'finance',
  },
  ownerStatement: {
    english: 'Owner Statement',
    somali: 'Warbixinta maaliyadeed ee milkiilaha',
    context: 'finance',
  },
  ownerPayout: {
    english: 'Owner Payout',
    somali: 'Lacagta milkiilaha',
    descriptionSomali:
      'Lacagta milkiilaha loo diyaariyey kadib dakhliga, kharashaadka iyo khidmada maamulka.',
    context: 'finance',
  },
  managementFee: {
    english: 'Management Fee',
    somali: 'Khidmada maamulka',
    descriptionSomali: 'Khidmada maamulka shirkadda.',
    context: 'finance',
  },
  commission: {
    english: 'Commission',
    somali: 'Komishan',
    context: 'finance',
  },
  journalEntry: {
    english: 'Journal Entry',
    somali: 'Diiwaanka xisaabaadka',
    context: 'finance',
  },
  debit: {
    english: 'Debit',
    somali: 'Debit',
    descriptionSomali: 'Dhinaca xisaabeed ee lacagta laga qaato ama lagu diiwaangeliyo.',
    context: 'finance',
  },
  credit: {
    english: 'Credit',
    somali: 'Credit',
    descriptionSomali: 'Dhinaca xisaabeed ee lacagta lagu darayo ama lagu diiwaangeliyo.',
    context: 'finance',
  },
  maintenance: {
    english: 'Maintenance',
    somali: 'Dayactir',
    context: 'operations',
  },
  maintenanceRequest: {
    english: 'Maintenance Request',
    somali: 'Codsi dayactir',
    context: 'operations',
  },
  workOrder: {
    english: 'Work Order',
    somali: 'Amarka shaqada',
    context: 'operations',
  },
  inspection: {
    english: 'Inspection',
    somali: 'Kormeer',
    context: 'operations',
  },
  defect: {
    english: 'Defect',
    somali: 'Cilad',
    context: 'operations',
  },
  vendor: {
    english: 'Vendor / Service Provider',
    somali: 'Bixiyaha adeegga',
    context: 'operations',
  },
  priority: {
    english: 'Priority',
    somali: 'Mudnaanta',
    context: 'operations',
  },
  assignedTo: {
    english: 'Assigned To',
    somali: 'Qofka loo xilsaaray',
    context: 'operations',
  },
  inProgress: {
    english: 'In Progress',
    somali: 'Shaqadu socotaa',
    context: 'operations',
  },
  onHold: {
    english: 'On Hold',
    somali: 'Hakadka ku jira',
    context: 'operations',
  },
  completed: {
    english: 'Completed',
    somali: 'La dhammeeyey',
    context: 'operations',
  },
  constructionProject: {
    english: 'Construction Project',
    somali: 'Mashruuca dhismaha',
    context: 'construction',
  },
  client: {
    english: 'Client',
    somali: 'Macmiil',
    context: 'construction',
  },
  constructionContract: {
    english: 'Construction Contract',
    somali: 'Heshiiska dhismaha',
    context: 'construction',
  },
  milestone: {
    english: 'Milestone',
    somali: 'Marxalad muhiim ah',
    context: 'construction',
  },
  workPackage: {
    english: 'Work Package',
    somali: 'Qayb shaqo',
    context: 'construction',
  },
  projectBudget: {
    english: 'Project Budget',
    somali: 'Miisaaniyadda mashruuca',
    context: 'construction',
  },
  actualCost: {
    english: 'Actual Cost',
    somali: 'Kharashka dhabta ah',
    context: 'construction',
  },
  budgetVariance: {
    english: 'Budget Variance',
    somali: 'Farqiga miisaaniyadda',
    context: 'construction',
  },
  handover: {
    english: 'Handover',
    somali: 'Wareejinta mashruuca',
    context: 'construction',
  },
  projectProgress: {
    english: 'Project Progress',
    somali: 'Horumarka mashruuca',
    context: 'construction',
  },
  developmentProject: {
    english: 'Development Project',
    somali: 'Mashruuca horumarinta dhulka/hantida',
    context: 'development',
  },
  developmentBlock: {
    english: 'Development Block',
    somali: 'Qayb qorsheysan oo mashruuca ah',
    context: 'development',
  },
  developmentPlot: {
    english: 'Development Plot',
    somali: 'Boos/dhul-hoosaad qorsheysan',
    descriptionSomali:
      'Qayb qorsheysan oo weli ah qaybta mashruuca horumarinta — ma aha property rasmi ah ilaa la beddelo.',
    context: 'development',
  },
  saleReady: {
    english: 'Sale-Ready',
    somali: 'Diyaar u ah iib',
    context: 'development',
  },
  outputProperty: {
    english: 'Output Property',
    somali: 'Property cusub oo mashruuca ka soo baxay',
    context: 'development',
  },
  propertyConversion: {
    english: 'Property Conversion',
    somali: 'U beddelidda plot/asset-ka property rasmi ah',
    context: 'development',
  },
  branch: {
    english: 'Branch',
    somali: 'Laan',
    descriptionSomali: 'Laanta masuulka ka ah property-ga.',
    context: 'general',
  },
  effectiveDate: {
    english: 'Effective Date',
    somali: 'Taariikhda dhaqan-galka',
    descriptionSomali: 'Taariikhda uu heshiiskan ama isbeddelkan dhaqan galayo.',
    context: 'general',
  },
  rentAmount: {
    english: 'Rent Amount',
    somali: 'Qiimaha kirada',
    context: 'leasing',
  },
  securityDeposit: {
    english: 'Security Deposit',
    somali: 'Lacagta dammaanadda',
    context: 'leasing',
  },
  search: {
    english: 'Search',
    somali: 'Raadi',
    context: 'filter',
  },
  status: {
    english: 'Status',
    somali: 'Xaalad',
    context: 'filter',
  },
  service: {
    english: 'Service',
    somali: 'Adeeg',
    context: 'filter',
  },
  dateRange: {
    english: 'Date Range',
    somali: 'Muddada taariikhda',
    context: 'filter',
  },
  resetFilters: {
    english: 'Reset Filters',
    somali: 'Nadiifi filters-ka',
    context: 'filter',
  },
  moreFilters: {
    english: 'More Filters',
    somali: 'Filters dheeraad ah',
    context: 'filter',
  },
  documents: {
    english: 'Documents',
    somali: 'Dukumiintiyada',
    context: 'workflow',
  },
  review: {
    english: 'Review',
    somali: 'Dib-u-eegis',
    context: 'workflow',
  },
  companyService: {
    english: 'Company Service',
    somali: 'Adeegga shirkadda',
    context: 'workflow',
  },
  statusDraft: {
    english: 'Draft',
    somali: 'Draft',
    descriptionSomali: 'Weli lama dhaqaajin.',
    context: 'status',
  },
  statusActive: {
    english: 'Active',
    somali: 'Active',
    descriptionSomali: 'Hadda wuu shaqeynayaa.',
    context: 'status',
  },
  statusOnHold: {
    english: 'On Hold',
    somali: 'On Hold',
    descriptionSomali: 'Si ku-meel-gaar ah ayaa loo hakiyey.',
    context: 'status',
  },
  statusCompleted: {
    english: 'Completed',
    somali: 'Completed',
    descriptionSomali: 'Waa la dhammeeyey.',
    context: 'status',
  },
  statusCancelled: {
    english: 'Cancelled',
    somali: 'Cancelled',
    descriptionSomali: 'Waa la joojiyey.',
    context: 'status',
  },
  statusInactive: {
    english: 'Inactive',
    somali: 'Inactive',
    descriptionSomali: 'Hadda ma shaqeynayo.',
    context: 'status',
  },
  activateProperty: {
    english: 'Activate Property',
    somali: 'Dhaqaaji property-ga',
    descriptionSomali:
      'Property-ga wuxuu noqonayaa mid diiwaangashan oo loo isticmaali karo shaqooyinka kale.',
    context: 'portfolio',
  },
  activateLease: {
    english: 'Activate Lease',
    somali: 'Dhaqaaji heshiiska kirada',
    descriptionSomali:
      'Haddii aad heshiiskan dhaqaajiso, wuxuu noqonayaa heshiiska kirada ee shaqeynaya.',
    context: 'leasing',
  },
  cancelReservation: {
    english: 'Cancel Reservation',
    somali: 'Jooji qabashada',
    descriptionSomali:
      'Qabashadan waa la joojinayaa, space-kuna mar kale wuu bannaan noqon karaa.',
    context: 'leasing',
  },
  recordPayment: {
    english: 'Record Payment',
    somali: 'Diiwaangeli lacag-bixinta',
    descriptionSomali:
      'Lacag-bintan waxaa lagu diiwaangelinayaa xisaabta, kadibna waxaa lagu xiriirin karaa invoice-ka.',
    context: 'finance',
  },
  postJournal: {
    english: 'Post Journal',
    somali: 'Post-garee diiwaanka xisaabeedka',
    descriptionSomali:
      'Marka la post-gareeyo, diiwaankan xisaabeed lama beddeli karo; sixitaan waxaa lagu sameeyaa reversal.',
    context: 'finance',
  },
  emptyRentalListings: {
    english: 'No Rental Listings Yet',
    somali: 'Weli ma jiro property kirada loo xayeysiiyey.',
    context: 'leasing',
  },
  emptyProperties: {
    english: 'No Properties Yet',
    somali: 'Weli ma jirto property la diiwaangeliyey.',
    context: 'portfolio',
  },
  emptyLeads: {
    english: 'No Leads Yet',
    somali: 'Weli ma jiro macmiil suurtagal ah.',
    context: 'crm',
  },
  propertyOnboarding: {
    english: 'Property Onboarding',
    somali: 'Diiwaangelinta property-ga',
    descriptionSomali:
      'Milkiilaha, lahaanshaha, property-ga iyo adeegyada shirkadda si wadajir ah u diiwaangeli.',
    context: 'workflow',
  },
  propertySale: {
    english: 'Property Sale',
    somali: 'Iibinta property-ga',
    context: 'commercial',
  },
  seller: {
    english: 'Seller',
    somali: 'Iibiyaha',
    context: 'commercial',
  },
  saleAuthority: {
    english: 'Sale Authority',
    somali: 'Ogolaanshaha iibka',
    descriptionSomali: 'Qeexitaanka awoodda shirkaddu u leedahay inay property-ga iibiso.',
    context: 'commercial',
  },
  saleReadiness: {
    english: 'Sale Readiness',
    somali: 'Diyaar-garowga iibka',
    context: 'commercial',
  },
  managementTerms: {
    english: 'Management Terms',
    somali: 'Shuruudaha maamulka',
    context: 'commercial',
  },
  ownershipEligibility: {
    english: 'Ownership Eligibility',
    somali: 'U qalmitaanka lahaanshaha',
    descriptionSomali: 'Hubi in lahaanshaha property-ga uu buuxiyo shuruudaha adeegga.',
    context: 'commercial',
  },
  listingMarketing: {
    english: 'Listing & Marketing',
    somali: 'Xayeysiin & suuq-geyn',
    context: 'commercial',
  },
  serviceDetails: {
    english: 'Service Details',
    somali: 'Faahfaahinta adeegga',
    context: 'commercial',
  },
  portalOwner: {
    english: 'Owner Portal',
    somali: 'Bogga milkiilaha',
    descriptionSomali: 'Milkiiluhu wuxuu halkan ka arkaa warbixinnada iyo xaaladda property-ga.',
    context: 'portal',
  },
  portalTenant: {
    english: 'Tenant Portal',
    somali: 'Bogga kiraystaha',
    descriptionSomali: 'Kiraystuhu wuxuu halkan ka arkaa heshiiska, lacag-bixinta iyo codsiyada.',
    context: 'portal',
  },
};

const statusKeyByValue: Record<string, TermKey> = {
  DRAFT: 'statusDraft',
  ACTIVE: 'statusActive',
  ON_HOLD: 'statusOnHold',
  COMPLETED: 'statusCompleted',
  CANCELLED: 'statusCancelled',
  INACTIVE: 'statusInactive',
};

export function getTerm(key: TermKey): TermDefinition {
  return terminologyDictionary[key];
}

export function getTermEnglish(key: TermKey): string {
  return terminologyDictionary[key].english;
}

export function getTermSomali(key: TermKey): string {
  return terminologyDictionary[key].somali;
}

export function getTermDescription(key: TermKey): string | undefined {
  return terminologyDictionary[key].descriptionSomali;
}

export function getStatusTermKey(status: string | null | undefined): TermKey | undefined {
  if (!status) return undefined;
  return statusKeyByValue[status.toUpperCase()];
}

export function getStatusGuidance(status: string | null | undefined): TermDefinition | undefined {
  const key = getStatusTermKey(status);
  return key ? terminologyDictionary[key] : undefined;
}
