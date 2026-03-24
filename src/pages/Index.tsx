import { useWizard } from "@/hooks/useWizard";
import { WizardSidebar } from "@/components/WizardSidebar";
import { ConfigStep } from "@/components/steps/ConfigStep";
import { SearchStep } from "@/components/steps/SearchStep";
import { MessagesStep } from "@/components/steps/MessagesStep";
import { TrackingStep } from "@/components/steps/TrackingStep";

const Index = () => {
  const wizard = useWizard();

  const renderStep = () => {
    switch (wizard.currentStep) {
      case 0:
        return <ConfigStep config={wizard.config} setConfig={wizard.setConfig} onComplete={() => wizard.completeStep(0)} />;
      case 1:
        return <SearchStep config={wizard.config} leads={wizard.leads} setLeads={wizard.setLeads} setScoredLeads={wizard.setScoredLeads} onComplete={() => wizard.completeStep(1)} />;
      case 2:
        return <MessagesStep scoredLeads={wizard.scoredLeads} setScoredLeads={wizard.setScoredLeads} onComplete={() => wizard.completeStep(2)} />;
      case 3:
        return <TrackingStep config={wizard.config} scoredLeads={wizard.scoredLeads} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen w-full">
      <WizardSidebar steps={wizard.steps} currentStep={wizard.currentStep} onStepClick={wizard.goToStep} />
      <main className="flex-1 p-8 max-w-5xl">
        {renderStep()}
      </main>
    </div>
  );
};

export default Index;
