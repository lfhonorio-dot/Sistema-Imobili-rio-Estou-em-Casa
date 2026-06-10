'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Calendário simples sem dependência de react-day-picker
interface CalendarProps {
  className?: string;
  selected?: Date;
  onSelect?: (date: Date) => void;
  month?: Date;
  onMonthChange?: (date: Date) => void;
}

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function Calendar({ className, selected, onSelect, month, onMonthChange }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(month || new Date());

  const year = currentMonth.getFullYear();
  const monthIndex = currentMonth.getMonth();

  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const handlePrevMonth = () => {
    const prev = new Date(year, monthIndex - 1, 1);
    setCurrentMonth(prev);
    onMonthChange?.(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(year, monthIndex + 1, 1);
    setCurrentMonth(next);
    onMonthChange?.(next);
  };

  const isSelected = (day: number) =>
    selected &&
    selected.getFullYear() === year &&
    selected.getMonth() === monthIndex &&
    selected.getDate() === day;

  const isToday = (day: number) => {
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === monthIndex && today.getDate() === day;
  };

  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className={cn('p-3', className)}>
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={handlePrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {MONTHS[monthIndex]} {year}
        </span>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => (
          <div key={i} className="aspect-square">
            {day !== null && (
              <button
                className={cn(
                  'w-full h-full rounded-md text-sm flex items-center justify-center',
                  isSelected(day) && 'bg-primary text-primary-foreground',
                  isToday(day) && !isSelected(day) && 'border border-primary font-bold',
                  !isSelected(day) && 'hover:bg-accent',
                )}
                onClick={() => onSelect?.(new Date(year, monthIndex, day))}
              >
                {day}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
