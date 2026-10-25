import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Droplets,
  FileText,
  Globe2,
  Heart,
  HeartPulse,
  LockKeyhole,
  Menu,
  MessageCircle,
  Phone,
  ShieldCheck,
  Stethoscope,
  UserRound,
  X,
  BriefcaseMedical,
  Zap,
  Send,
  Settings,
  LayoutDashboard,
  LogOut,
  Search,
  Bell,
  Upload,
  Plus,
} from "lucide-react";
const icons = {
  activity: Activity,
  arrow: ArrowUpRight,
  calendar: CalendarDays,
  check: Check,
  down: ChevronDown,
  left: ChevronLeft,
  right: ChevronRight,
  clock: Clock3,
  copy: Copy,
  drop: Droplets,
  globe: Globe2,
  heart: HeartPulse,
  lock: LockKeyhole,
  menu: Menu,
  message: MessageCircle,
  phone: Phone,
  shield: ShieldCheck,
  doctor: Stethoscope,
  user: UserRound,
  close: X,
  case: BriefcaseMedical,
  thyroid: Zap,
  liver: Heart,
  file: FileText,
  send: Send,
  settings: Settings,
  dashboard: LayoutDashboard,
  logout: LogOut,
  search: Search,
  bell: Bell,
  upload: Upload,
  plus: Plus,
};
export type IconName = keyof typeof icons;
export function Icon({
  name,
  size = 22,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const Component = icons[name];
  return (
    <Component
      size={size}
      strokeWidth={1.65}
      className={className}
      aria-hidden="true"
    />
  );
}
