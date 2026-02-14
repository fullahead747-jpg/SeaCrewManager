import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CrewAvatar } from '../crew/crew-avatar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle, Clock, AlertTriangle, Users, Ship } from 'lucide-react';
import { format } from 'date-fns';
import { formatDate } from '@/lib/utils';

interface CrewMember {
  id: string;
  firstName: string;
  lastName: string;
  rank: string;
  status: string;
  activeContract?: {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  currentVessel?: {
    name: string;
  };
}

interface ContractStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractType: 'valid' | 'due' | 'expired';
  crewMembers: CrewMember[];
  vesselName: string;
}

export default function ContractStatusModal({
  isOpen,
  onClose,
  contractType,
  crewMembers,
  vesselName
}: ContractStatusModalProps) {
  const getContractInfo = (type: 'valid' | 'due' | 'expired') => {
    switch (type) {
      case 'valid':
        return {
          title: 'Contract Valid',
          description: 'Crew members with contracts valid for more than 45 days',
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50 dark:bg-green-950/20',
          borderColor: 'border-green-200 dark:border-green-800'
        };
      case 'due':
        return {
          title: 'Sign Off Due',
          description: 'Crew members with contracts expiring within 45 days',
          icon: Clock,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
          borderColor: 'border-yellow-200 dark:border-yellow-800'
        };
      case 'expired':
        return {
          title: 'Contract Expired',
          description: 'Crew members with expired contracts',
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-50 dark:bg-red-950/20',
          borderColor: 'border-red-200 dark:border-red-800'
        };
    }
  };

  const contractInfo = getContractInfo(contractType);
  const Icon = contractInfo.icon;

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getContractDaysRemaining = (member: CrewMember) => {
    if (!member.activeContract) return 0;

    const now = new Date();
    const endDate = new Date(member.activeContract.endDate);
    const daysDiff = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Return days remaining (can be negative if expired, positive if future)
    return daysDiff;
  };

  const getContractEndDate = (member: CrewMember) => {
    if (!member.activeContract) return new Date();
    return new Date(member.activeContract.endDate);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Icon className={`h-5 w-5 ${contractInfo.color}`} />
            <span>{contractInfo.title} - {vesselName}</span>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {contractInfo.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {crewMembers.length === 0 ? (
            <div className={`text-center py-8 ${contractInfo.bgColor} border ${contractInfo.borderColor} rounded-lg`}>
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-medium text-foreground mb-1">No Crew Members</h3>
              <p className="text-sm text-muted-foreground">
                No crew members found with {contractType} contracts for this vessel.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Ship className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{crewMembers.length} crew members</span>
                </div>
                <Badge variant="outline" className={contractInfo.color}>
                  {contractInfo.title}
                </Badge>
              </div>

              <div className="space-y-3">
                {crewMembers.map((member) => {
                  const contractEndDate = getContractEndDate(member);
                  const daysRemaining = getContractDaysRemaining(member);

                  return (
                    <div
                      key={member.id}
                      className={`p-4 border rounded-lg ${contractInfo.bgColor} ${contractInfo.borderColor}`}
                      data-testid={`contract-crew-${member.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <CrewAvatar
                            memberId={member.id}
                            documents={(member as any).documents}
                            firstName={member.firstName}
                            lastName={member.lastName}
                            className="bg-maritime-navy"
                          />

                          <div className="flex-1">
                            <h4 className="font-medium text-foreground" data-testid="crew-name">
                              {member.firstName} {member.lastName}
                            </h4>
                            <p className="text-sm text-muted-foreground mb-2">{member.rank}</p>

                            <div className="space-y-1">
                              <div className="flex items-center space-x-2 text-sm">
                                <span className="text-muted-foreground">Contract Start:</span>
                                <span className="font-medium text-foreground" data-testid="contract-start-date">
                                  {member.activeContract ? formatDate(new Date(member.activeContract.startDate)) : 'No Contract'}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2 text-sm">
                                <span className="text-muted-foreground">Contract End:</span>
                                <span className="font-medium text-foreground" data-testid="contract-end-date">
                                  {member.activeContract ? formatDate(contractEndDate) : 'No Contract'}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2 text-sm">
                                <span className="text-muted-foreground">Status:</span>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${!member.activeContract
                                    ? 'text-gray-600 border-gray-200'
                                    : daysRemaining <= 0
                                      ? 'text-red-600 border-red-200'
                                      : daysRemaining <= 45
                                        ? 'text-yellow-600 border-yellow-200'
                                        : 'text-green-600 border-green-200'
                                    }`}
                                  data-testid="contract-status"
                                >
                                  {!member.activeContract
                                    ? 'No Active Contract'
                                    : daysRemaining <= 0
                                      ? 'Expired'
                                      : `${daysRemaining} days remaining`
                                  }
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center">
                          <Icon className={`h-4 w-4 ${contractInfo.color}`} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}