import { Printer, HardDrive, Users, Calendar, User } from 'lucide-react';
import { cn } from '@/utils/cn';

interface StatusBarProps {
  printCount?: number;
  imagesSize?: string;
  totalPatients?: number;
  oldestDate?: string;
  loginUser?: string;
}

interface StatusItemProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  className?: string;
}

function StatusItem({ icon: Icon, label, value, className }: StatusItemProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)} title={label}>
      <Icon className="h-3 w-3 text-foreground-muted" />
      <span className="text-2xs text-foreground-muted">{label}:</span>
      <span className="text-2xs font-medium text-foreground-secondary">{value}</span>
    </div>
  );
}

export function StatusBar({
  printCount = 0,
  imagesSize = '0 MB',
  totalPatients = 0,
  oldestDate = '--',
  loginUser = 'Unknown',
}: StatusBarProps) {
  return (
    <div
      className={cn(
        'flex h-7 shrink-0 items-center justify-between border-t border-border',
        'bg-background-secondary px-4'
      )}
    >
      <div className="flex items-center gap-4">
        <StatusItem icon={Printer} label="Prints left" value={printCount} />
        <StatusItem icon={HardDrive} label="Images" value={imagesSize} />
        <StatusItem icon={Users} label="Records" value={totalPatients} />
        <StatusItem icon={Calendar} label="Oldest" value={oldestDate} />
      </div>
      <div className="flex items-center gap-1.5">
        <StatusItem icon={User} label="User" value={loginUser} />
      </div>
    </div>
  );
}
