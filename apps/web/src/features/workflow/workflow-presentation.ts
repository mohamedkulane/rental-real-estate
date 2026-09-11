import type { GuidedStep } from './guided-workflow-shell';
import { workflowLabels, type WorkflowType } from './workflow-types';

export type GuidedServiceWorkflow = WorkflowType;

export type WorkflowPresentation = {
  title: string;
  subtitle: string;
  breadcrumbs: Array<{ label: string; href?: string }>;
  steps: GuidedStep[];
};

const defaultStepDescription = 'Complete this step to continue the guided workflow.';

export const guidedServiceWorkflows: GuidedServiceWorkflow[] = [
  'PROPERTY_ONBOARDING',
  'RENTAL_BROKERAGE',
  'FULL_MANAGEMENT',
  'PROPERTY_SALE',
];

export function isGuidedServiceWorkflow(type: WorkflowType): type is GuidedServiceWorkflow {
  return guidedServiceWorkflows.includes(type);
}

export const workflowPresentation: Record<GuidedServiceWorkflow, WorkflowPresentation> = {
  PROPERTY_ONBOARDING: {
    title: workflowLabels.PROPERTY_ONBOARDING,
    subtitle: 'Register the owner, property and services together with our guided workflow.',
    breadcrumbs: [
      { label: 'Portfolio', href: '/portfolio/properties' },
      { label: 'Property Onboarding', href: '/workflows/new?type=PROPERTY_ONBOARDING' },
      { label: 'Start New' },
    ],
    steps: [
      { label: 'Owner', sidebarHint: 'Select or create the owner' },
      { label: 'Ownership', sidebarHint: 'Set ownership shares' },
      { label: 'Property', sidebarHint: 'Enter property details' },
      { label: 'Building', sidebarHint: 'Add building or structure' },
      { label: 'Rentable Spaces', sidebarHint: 'Add rentable spaces' },
      { label: 'Company Service', sidebarHint: 'Select company service' },
      { label: 'Documents', sidebarHint: 'Upload required files' },
      { label: 'Review', sidebarHint: 'Review and complete' },
    ],
  },
  RENTAL_BROKERAGE: {
    title: workflowLabels.RENTAL_BROKERAGE,
    subtitle: 'List and lease properties quickly with our guided workflow.',
    breadcrumbs: [
      { label: 'Rental', href: '/marketing/rental-listings' },
      { label: 'Rental Brokerage', href: '/workflows/new?type=RENTAL_BROKERAGE' },
      { label: 'Start New' },
    ],
    steps: [
      { label: 'Owner', sidebarHint: 'Select the property owner' },
      { label: 'Property', sidebarHint: 'Choose the property you want to list' },
      { label: 'Rentable Space', sidebarHint: 'Choose the space or unit' },
      { label: 'Service Details', sidebarHint: 'Configure brokerage service' },
      { label: 'Listing & Marketing', sidebarHint: 'Add readiness notes' },
      { label: 'Documents', sidebarHint: 'Upload required files' },
      { label: 'Review', sidebarHint: 'Confirm workflow details' },
      { label: 'Activate', sidebarHint: 'Finalize and activate' },
    ],
  },
  FULL_MANAGEMENT: {
    title: workflowLabels.FULL_MANAGEMENT,
    subtitle: 'Set up full property management with our guided workflow.',
    breadcrumbs: [
      { label: 'Commercial', href: '/commercial/service-engagements' },
      { label: 'Full Management', href: '/workflows/new?type=FULL_MANAGEMENT' },
      { label: 'Start New' },
    ],
    steps: [
      { label: 'Owner', sidebarHint: 'Select the property owner' },
      { label: 'Property', sidebarHint: 'Choose the managed property' },
      { label: 'Ownership Eligibility', sidebarHint: 'Verify ownership evidence' },
      { label: 'Rentable Spaces', sidebarHint: 'Choose managed spaces' },
      { label: 'Management Service', sidebarHint: 'Configure full management service' },
      { label: 'Management Terms', sidebarHint: 'Record management terms' },
      { label: 'Documents', sidebarHint: 'Upload required files' },
      { label: 'Review & Activate', sidebarHint: 'Review and activate service' },
    ],
  },
  PROPERTY_SALE: {
    title: workflowLabels.PROPERTY_SALE,
    subtitle: 'Prepare a property sale with our guided workflow.',
    breadcrumbs: [
      { label: 'Sales', href: '/marketing/sale-listings' },
      { label: 'Property Sale', href: '/workflows/new?type=PROPERTY_SALE' },
      { label: 'Start New' },
    ],
    steps: [
      { label: 'Seller', sidebarHint: 'Select seller when external' },
      { label: 'Property', sidebarHint: 'Choose the sale property' },
      { label: 'Ownership Evidence', sidebarHint: 'Verify ownership evidence' },
      { label: 'Sale Authority', sidebarHint: 'Configure sale authority' },
      { label: 'Sale Readiness', sidebarHint: 'Record sale readiness notes' },
      { label: 'Documents', sidebarHint: 'Upload required files' },
      { label: 'Review', sidebarHint: 'Confirm workflow details' },
      { label: 'Activate', sidebarHint: 'Finalize and activate' },
    ],
  },
};

export function stepPresentation(
  type: GuidedServiceWorkflow,
  step: number,
): { title: string; description: string } {
  const meta = workflowPresentation[type].steps[step - 1];
  if (!meta) {
    return { title: `Step ${step}`, description: defaultStepDescription };
  }
  return {
    title: meta.label,
    description: meta.sidebarHint,
  };
}
