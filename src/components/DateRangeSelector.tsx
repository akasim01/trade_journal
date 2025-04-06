import React, { useState, useRef, useEffect } from 'react';
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subYears,
  isSameDay,
  eachDayOfInterval,
  startOfMonth as getStartOfMonth,
  endOfMonth as getEndOfMonth,
  addMonths,
  subMonths
} from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { DateRangePeriod } from '../types';

interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangeSelectorProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  period: DateRangePeriod;
  onPeriodChange: (period: DateRangePeriod) => void;
}

export default function DateRangeSelector({
  dateRange,
  onDateRangeChange,
  period,
  onPeriodChange
}: DateRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(getStartOfMonth(dateRange.start));
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePeriodChange = (newPeriod: DateRangePeriod) => {
    onPeriodChange(newPeriod);
    setTempStartDate(null);
    
    const today = new Date();
    let start: Date;
    let end: Date;

    switch (newPeriod) {
      case 'daily':
        start = startOfDay(today);
        end = endOfDay(today);
        break;
      case 'weekly':
        start = startOfWeek(today);
        end = endOfWeek(today);
        break;
      case 'monthly':
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case 'yearly':
        start = startOfYear(today);
        end = endOfYear(today);
        break;
      case 'all':
        // Show last 5 years of data by default for "All"
        start = startOfDay(subYears(today, 5));
        end = endOfDay(today);
        break;
    }

    onDateRangeChange({ start, end });
  };

  const monthStart = getStartOfMonth(currentMonth);
  const monthEnd = getEndOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const handleDateSelect = (date: Date) => {
    const newDate = startOfDay(date);
    
    if (!tempStartDate) {
      setTempStartDate(newDate);
    } else {
      // If the new date is before the temp start date, swap them
      const start = newDate < tempStartDate ? newDate : tempStartDate;
      const end = newDate < tempStartDate ? tempStartDate : newDate;
      
      onDateRangeChange({
        start: start,
        end: endOfDay(end)
      });
      
      setTempStartDate(null);
      setIsOpen(false);
    }
  };

  const formatDateRange = () => {
    if (period === 'all') {
      return 'All Time';
    }
    if (isSameDay(dateRange.start, dateRange.end)) {
      return format(dateRange.start, 'MMM d, yyyy');
    }
    return `${format(dateRange.start, 'MMM d')} — ${format(dateRange.end, 'MMM d, yyyy')}`;
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      <div className="flex flex-wrap gap-2">
        {/* Period buttons */}
        <button
          onClick={() => handlePeriodChange('daily')}
          className={`flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm ${
            period === 'daily'
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Daily
        </button>
        <button
          onClick={() => handlePeriodChange('weekly')}
          className={`flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm ${
            period === 'weekly'
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Weekly
        </button>
        <button
          onClick={() => handlePeriodChange('monthly')}
          className={`flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm ${
            period === 'monthly'
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => handlePeriodChange('yearly')}
          className={`flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm ${
            period === 'yearly'
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Yearly
        </button>
        <button
          onClick={() => handlePeriodChange('all')}
          className={`flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm ${
            period === 'all'
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
      </div>

      <div className="relative" ref={calendarRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-medium bg-white shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <CalendarIcon className="h-4 w-4 text-gray-500 mr-1.5" />
          {formatDateRange()}
        </button>
        {tempStartDate && (
          <div className="absolute -bottom-6 left-0 text-xs text-blue-600">
            Select end date
          </div>
        )}

        {isOpen && (
          <div className="absolute z-10 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-[280px]">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </button>
              <h2 className="text-lg font-semibold text-gray-900">
                {format(currentMonth, 'MMMM yyyy')}
              </h2>
              <button
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronRight className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-gray-600 p-2"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const isStartDate = tempStartDate ? isSameDay(day, tempStartDate) : isSameDay(day, dateRange.start);
                const isEndDate = !tempStartDate && isSameDay(day, dateRange.end);
                const isInRange = !tempStartDate && day >= dateRange.start && day <= dateRange.end;
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isInTempRange = tempStartDate && day >= tempStartDate;

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => handleDateSelect(day)}
                    className={`
                      p-2 text-sm rounded-lg
                      ${(isStartDate || isEndDate)
                        ? 'bg-blue-600 text-white font-semibold hover:bg-blue-700'
                        : (isInRange || isInTempRange)
                        ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        : isCurrentMonth
                        ? 'text-gray-900 hover:bg-gray-100'
                        : 'text-gray-400'
                      }
                    `}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}