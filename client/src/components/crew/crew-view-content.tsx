import { CrewMemberWithDetails, Vessel } from '@shared/schema';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CrewViewContentProps {
  activeTab: string;
  crewMember: CrewMemberWithDetails;
  vessels: Vessel[];
}

export function CrewViewContent({ activeTab, crewMember, vessels }: CrewViewContentProps) {
  const getDocument = (type: string) => crewMember.documents?.find(d => d.type === type);
  
  const renderField = (label: string, value: any, fallback = 'Not provided') => (
    <div className="flex flex-col space-y-0.5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm text-foreground font-semibold">{value || fallback}</span>
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Card className="border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm">
        <CardHeader className="pb-2 border-b border-blue-100 dark:border-blue-900">
          <CardTitle className="text-xs font-semibold text-blue-900 dark:text-blue-100 uppercase tracking-widest flex items-center">
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2"></div>
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 grid grid-cols-2 gap-y-4 gap-x-4">
          {renderField("First Name", crewMember.firstName)}
          {renderField("Last Name", crewMember.lastName)}
          {renderField("Nationality", crewMember.nationality)}
          {renderField("Date of Birth", crewMember.dateOfBirth ? formatDate(crewMember.dateOfBirth) : null)}
          {renderField("Phone Number", crewMember.phoneNumber)}
          {renderField("Email", crewMember.email)}
          {renderField("Postal Address", (crewMember as any).postalAddress)}
        </CardContent>
      </Card>
    </div>
  );

  const renderProfessional = () => {
    const vessel = vessels.find(v => v.id === crewMember.currentVesselId);
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <Card className="border-green-100 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20 shadow-sm">
          <CardHeader className="pb-2 border-b border-green-100 dark:border-green-900">
            <CardTitle className="text-xs font-semibold text-green-900 dark:text-green-100 uppercase tracking-widest flex items-center">
              <div className="w-1.5 h-1.5 bg-green-600 rounded-full mr-2"></div>
              Professional Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 grid grid-cols-2 gap-y-4 gap-x-4">
            {renderField("Rank", crewMember.rank)}
            <div className="flex flex-col space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</span>
              <div>
                <Badge variant={crewMember.status === 'onBoard' ? 'default' : 'secondary'} className={crewMember.status === 'onBoard' ? 'bg-green-100 text-green-800 hover:bg-green-200' : ''}>
                  {crewMember.status === 'onBoard' ? 'On Board' : 'On Shore'}
                </Badge>
              </div>
            </div>
            {renderField("Current Vessel", vessel ? vessel.name : 'Unassigned')}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderNOK = () => {
    const nok = crewMember.emergencyContact as any;
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <Card className="border-orange-100 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20 shadow-sm">
          <CardHeader className="pb-2 border-b border-orange-100 dark:border-orange-900">
            <CardTitle className="text-xs font-semibold text-orange-900 dark:text-orange-100 uppercase tracking-widest flex items-center">
              <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mr-2"></div>
              Emergency Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 grid grid-cols-2 gap-y-4 gap-x-4">
            {renderField("Contact Name", nok?.name)}
            {renderField("Relationship", nok?.relationship)}
            {renderField("Contact Phone", nok?.phone)}
            {renderField("Contact Email", nok?.email)}
            <div className="col-span-2">
              {renderField("Postal Address", nok?.postalAddress)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderDocument = (title: string, color: string, doc: any, isNotApplicable?: boolean, issuingAuthorityLabel = 'Issuing Authority', hideDates = false) => {
    if (isNotApplicable) {
      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Card className={`border-${color}-100 dark:border-${color}-900 bg-${color}-50/50 dark:bg-${color}-950/20 shadow-sm`}>
            <CardHeader className={`pb-2 border-b border-${color}-100 dark:border-${color}-900 flex flex-row items-center justify-between`}>
              <CardTitle className={`text-xs font-semibold text-${color}-900 dark:text-${color}-100 uppercase tracking-widest flex items-center`}>
                <div className={`w-1.5 h-1.5 bg-${color}-600 rounded-full mr-2`}></div>
                {title} Details
              </CardTitle>
              <Badge variant="outline" className="bg-gray-100 text-gray-500">Not Applicable</Badge>
            </CardHeader>
            <CardContent className="pt-8 pb-8 flex justify-center items-center">
              <p className="text-muted-foreground italic">This document is marked as Not Applicable (N/A) for this crew member.</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <Card className={`border-${color}-100 dark:border-${color}-900 bg-${color}-50/50 dark:bg-${color}-950/20 shadow-sm`}>
          <CardHeader className={`pb-2 border-b border-${color}-100 dark:border-${color}-900`}>
            <CardTitle className={`text-xs font-semibold text-${color}-900 dark:text-${color}-100 uppercase tracking-widest flex items-center`}>
              <div className={`w-1.5 h-1.5 bg-${color}-600 rounded-full mr-2`}></div>
              {title} Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 grid grid-cols-2 gap-y-4 gap-x-4">
            {renderField("Document Number", doc?.documentNumber)}
            {renderField(issuingAuthorityLabel, doc?.issuingAuthority)}
            {!hideDates && renderField("Issue Date", doc?.issueDate ? formatDate(doc.issueDate) : null)}
            {!hideDates && renderField("Expiry Date", doc?.expiryDate ? formatDate(doc.expiryDate) : null, doc?.expiryDate === null ? 'TBD' : 'Not provided')}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderContract = () => {
    const contract = crewMember.activeContract;
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <Card className="border-sky-100 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/20 shadow-sm">
          <CardHeader className="pb-2 border-b border-sky-100 dark:border-sky-900">
            <CardTitle className="text-xs font-semibold text-sky-900 dark:text-sky-100 uppercase tracking-widest flex items-center">
              <div className="w-1.5 h-1.5 bg-sky-600 rounded-full mr-2"></div>
              Contract Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 grid grid-cols-2 gap-y-4 gap-x-4">
            {renderField("Start Date", contract?.startDate ? formatDate(contract.startDate) : null)}
            {renderField("Duration (Days)", contract?.durationDays)}
            {renderField("End Date", contract?.endDate ? formatDate(contract.endDate) : null)}
            <div className="flex flex-col space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</span>
              <div>
                {contract ? (
                  <Badge variant="outline" className={contract.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : ''}>
                    {contract.status.toUpperCase()}
                  </Badge>
                ) : (
                  <span className="text-sm font-semibold">No active contract</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'professional': return renderProfessional();
      case 'nok': return renderNOK();
      case 'passport': return renderDocument("Passport", "purple", getDocument('passport'), crewMember.passportNotApplicable ?? undefined);
      case 'cdc': return renderDocument("CDC", "teal", getDocument('cdc'), crewMember.cdcNotApplicable ?? undefined);
      case 'coc': return renderDocument("COC", "indigo", getDocument('coc'), crewMember.cocNotApplicable ?? undefined);
      case 'medical': return renderDocument("Medical Certificate", "rose", getDocument('medical'), crewMember.medicalNotApplicable ?? undefined);
      case 'stcw': return renderDocument("Course / STCW", "orange", getDocument('stcw_course'), crewMember.stcwNotApplicable ?? undefined, 'Issuing Authority', true);
      case 'sid': return renderDocument("SID", "violet", getDocument('sid'), false, 'Place of Issue');
      case 'contract': return renderContract();
      default: return renderOverview();
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto h-full bg-white dark:bg-gray-950">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300 flex-shrink-0">
            {crewMember.firstName?.charAt(0)}{crewMember.lastName?.charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
              {crewMember.firstName} {crewMember.lastName}
            </h2>
            <p className="text-slate-500 font-medium text-xs flex items-center gap-1.5 mt-0.5">
              {crewMember.rank}
              <span className="h-0.5 w-0.5 bg-slate-400 rounded-full"></span>
              {crewMember.nationality}
            </p>
          </div>
        </div>
        {renderContent()}
      </div>
    </div>
  );
}
