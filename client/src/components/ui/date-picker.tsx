import * as React from "react"
import { format, parseISO, isValid, subDays, startOfMonth, parse } from "date-fns"
import { Calendar as CalendarIcon, ChevronDown, Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  ({ value, onChange, disabled, className, placeholder = "DD / MM / YYYY", ...props }, ref) => {
    const parsedDate = React.useMemo(() => {
      if (!value) return undefined;
      const date = parseISO(value);
      return isValid(date) ? date : undefined;
    }, [value]);

    const [date, setDate] = React.useState<Date | undefined>(parsedDate);
    const [inputValue, setInputValue] = React.useState<string>("");
    const [open, setOpen] = React.useState(false);

    // Update input value when external value changes
    React.useEffect(() => {
      setDate(parsedDate);
      if (parsedDate) {
        setInputValue(format(parsedDate, "dd / MM / yyyy"));
      } else {
        // Only clear if the input isn't being actively typed into
        if (inputValue.replace(/\D/g, "").length === 0) {
          setInputValue("");
        }
      }
    }, [parsedDate]);

    const handleSelect = (selectedDate: Date | undefined) => {
      setDate(selectedDate);
      if (selectedDate) {
        const formatted = format(selectedDate, "yyyy-MM-dd");
        if (onChange) onChange(formatted);
        setInputValue(format(selectedDate, "dd / MM / yyyy"));
        setOpen(false);
      } else {
        if (onChange) onChange("");
        setInputValue("");
      }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const originalValue = e.target.value;
      let val = originalValue.replace(/\D/g, ""); // Keep only digits
      if (val.length > 8) val = val.slice(0, 8); // Limit to 8 digits

      // Format as DD / MM / YYYY
      let formatted = "";
      if (val.length > 0) {
        formatted += val.slice(0, 2);
        if (val.length > 2) {
          formatted += " / " + val.slice(2, 4);
          if (val.length > 4) {
            formatted += " / " + val.slice(4, 8);
          }
        }
      }
      setInputValue(formatted);

      // Try to parse if complete
      if (val.length === 8) {
        const d = parse(val, "ddMMyyyy", new Date());
        if (isValid(d)) {
          setDate(d);
          if (onChange) onChange(format(d, "yyyy-MM-dd"));
        }
      } else if (val.length === 0) {
        setDate(undefined);
        if (onChange) onChange("");
      }
    };

    const setToday = () => handleSelect(new Date());
    const setYesterday = () => handleSelect(subDays(new Date(), 1));
    const setStartOfMonth = () => handleSelect(startOfMonth(new Date()));
    const clearDate = () => handleSelect(undefined);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className={cn("relative group", className)}>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
              <CalendarIcon className={cn("h-4 w-4 transition-colors", open ? "text-blue-500" : "text-slate-400")} />
            </div>
            <Input
              {...props}
              ref={ref}
              disabled={disabled}
              value={inputValue}
              onChange={handleInputChange}
              placeholder={placeholder}
              className={cn(
                "pl-10 pr-10 w-full bg-white dark:bg-gray-950 transition-all",
                "border-slate-200 dark:border-slate-800 hover:border-blue-500",
                "focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 outline-none cursor-text",
                open && "border-blue-500 ring-2 ring-blue-500/20"
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
              <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", open && "rotate-180")} />
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 flex flex-col md:flex-row overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl" align="start">
          <div className="flex flex-col md:flex-row">
            <div className="flex flex-col bg-white dark:bg-gray-950">
              <div className="p-1">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleSelect}
                  initialFocus
                  captionLayout="dropdown-buttons"
                  fromYear={1940}
                  toYear={2050}
                  className="rounded-none"
                />
              </div>
              <div className="flex items-center justify-between p-3 border-t border-slate-100 dark:border-slate-800">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 h-8 flex items-center gap-1"
                  onClick={setToday}
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Today
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 h-8"
                  onClick={clearDate}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="hidden md:flex flex-col w-44 bg-slate-50/50 dark:bg-slate-900/50 border-l border-slate-100 dark:border-slate-800 p-3 gap-y-2">
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1 ml-1 opacity-70">Quick Select</div>
              <QuickSelectButton icon={<Clock className="h-3 w-3" />} label="Today" onClick={setToday} active={date && format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")} />
              <QuickSelectButton label="Yesterday" onClick={setYesterday} />
              <QuickSelectButton label="This Month" onClick={setStartOfMonth} />
              <div className="mt-auto pt-2 border-t border-slate-200 dark:border-slate-700">
                <Button variant="ghost" className="w-full justify-start text-xs text-slate-500 h-8 font-normal" disabled>
                  Custom Range &gt;
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    )
  }
)

DatePicker.displayName = "DatePicker"

function QuickSelectButton({ label, onClick, icon, active }: { label: string; onClick: () => void; icon?: React.ReactNode; active?: boolean }) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "w-full justify-start text-xs font-normal h-8 px-2 transition-all",
        active 
          ? "bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50" 
          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
      )}
      onClick={onClick}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {!icon && <CalendarIcon className={cn("mr-2 h-3 w-3", active ? "text-blue-500" : "text-slate-400")} />}
      {label}
    </Button>
  )
}

