import { FileText, Heart, Ship, Award } from 'lucide-react';
import type { Document } from '@shared/schema';
import { getDocumentStatus, getDocumentStatusColor } from '@/lib/crew-status-calculator';

interface DocumentStatusGridProps {
    documents: Document[];
}

export function DocumentStatusGrid({ documents }: DocumentStatusGridProps) {
    const passport = documents.find(d => d.type === 'passport');
    const medical = documents.find(d => d.type === 'medical');
    const cdc = documents.find(d => d.type === 'cdc');
    const coc = documents.find(d => d.type === 'coc');

    const passportStatus = getDocumentStatus(passport);
    const medicalStatus = getDocumentStatus(medical);
    const cdcStatus = getDocumentStatus(cdc);
    const cocStatus = getDocumentStatus(coc);

    const DocumentIcon = ({
        Icon,
        status,
        label
    }: {
        Icon: typeof FileText;
        status: 'valid' | 'expiring' | 'expired' | 'missing';
        label: string;
    }) => (
        <div
            className="flex flex-col items-center justify-center p-2 rounded-lg transition-all hover:scale-105"
            style={{
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: getDocumentStatusColor(status),
                backgroundColor: `${getDocumentStatusColor(status)}10`
            }}
            title={`${label}: ${status.charAt(0).toUpperCase() + status.slice(1)}`}
        >
            <Icon
                className="w-5 h-5"
                style={{ color: getDocumentStatusColor(status) }}
            />
            <span className="text-[10px] font-medium mt-1" style={{ color: getDocumentStatusColor(status) }}>
                {label}
            </span>
        </div>
    );

    const aoa = documents.find(d => d.type === 'aoa');
    const aoaStatus = getDocumentStatus(aoa);

    return (
        <div className="grid grid-cols-5 gap-2 w-full">
            <DocumentIcon Icon={FileText} status={passportStatus} label="PASS" />
            <DocumentIcon Icon={Heart} status={medicalStatus} label="MED" />
            <DocumentIcon Icon={Ship} status={cdcStatus} label="CDC" />
            <DocumentIcon Icon={Award} status={cocStatus} label="COC" />
            <DocumentIcon Icon={FileText} status={aoaStatus} label="AOA" />
        </div>
    );
}
