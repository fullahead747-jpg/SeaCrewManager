import { CrewMemberWithDetails, Vessel } from '@shared/schema';
import { PersonalInfoSection } from './edit-sections/personal-info';
import { ProfessionalInfoSection } from './edit-sections/professional-info';
import { NextOfKinSection } from './edit-sections/next-of-kin-form';
import { PassportSection } from './edit-sections/passport-form';
import { CDCSection } from './edit-sections/cdc-form';
import { COCSection } from './edit-sections/coc-form';
import { MedicalSection } from './edit-sections/medical-form';
import { STCWSection } from './edit-sections/stcw-form';
import { ContractSection } from './edit-sections/contract-form';

interface CrewFormContentProps {
    activeTab: string;
    crewMember?: CrewMemberWithDetails;
    vessels: Vessel[];
}

export function CrewFormContent({ activeTab, crewMember, vessels }: CrewFormContentProps) {
    const renderContent = () => {
        switch (activeTab) {
            case 'overview':
                return <PersonalInfoSection crewMember={crewMember} />;
            case 'professional':
                return <ProfessionalInfoSection vessels={vessels} />;
            case 'nok':
                return <NextOfKinSection />;
            case 'passport':
                return <PassportSection />;
            case 'cdc':
                return <CDCSection />;
            case 'coc':
                return <COCSection />;
            case 'medical':
                return <MedicalSection />;
            case 'stcw':
                return <STCWSection />;
            case 'contract':
                return <ContractSection crewMember={crewMember} />;
            default:
                return <PersonalInfoSection crewMember={crewMember} />;
        }
    };

    return (
        <div className="flex-1 p-6 overflow-y-auto h-full bg-white dark:bg-gray-950">
            {renderContent()}
        </div>
    );
}
