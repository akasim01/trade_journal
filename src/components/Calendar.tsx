import React, { useState, useRef, useEffect } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  isValid,
  startOfWeek,
  addDays,
  endOfWeek
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CalendarDays } from 'lucide-react';

interface CalendarProps {
  selectedDate: Date;
  onChange: (date: Date) => void;
  className?: string;
}

const Calendar = ({ selectedDate, onChange, className = '' }: CalendarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));
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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), i);
    return {
      key: `day-${i}`,
      label: format(date, 'EEEEE')
    };
  });

  const handleDateSelect = (date: Date) => {
    const newDate = new Date(date);
    newDate.setHours(selectedDate.getHours());
    newDate.setMinutes(selectedDate.getMinutes());
    newDate.setSeconds(selectedDate.getSeconds());
    newDate.setMilliseconds(selectedDate.getMilliseconds());

    onChange(newDate);
    setIsOpen(false);
  };

  const handleTodayClick = () => {
    const today = new Date();
    setCurrentMonth(startOfMonth(today));
    handleDateSelect(today);
  };

  return (
    <div className={`relative ${className}`} ref={calendarRef}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center py-1.5"
        >
          <CalendarIcon className="h-4 w-4 text-gray-500 mr-1.5" />
          <span>{format(selectedDate, 'MMM d, yyyy')}</span>
        </button>
        <button
          type="button"
          onClick={handleTodayClick}
          className="flex items-center px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
        >
          <CalendarDays className="h-4 w-4 mr-1" />
          Today
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-[280px]">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            </button>
            <h2 className="text-sm font-semibold text-gray-900">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day) => (
              <div
                key={day.key}
                className="text-center text-xs font-medium text-gray-600 p-1"
              >
                {day.label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleDateSelect(day)}
                  className={`
                    p-1 text-sm rounded-lg relative
                    ${isSelected
                      ? 'bg-blue-600 text-white font-semibold hover:bg-blue-700'
                      : isCurrentMonth
                      ? 'text-gray-900 hover:bg-gray-100'
                      : 'text-gray-400'
                    }
                    ${isToday && !isSelected ? 'ring-2 ring-blue-600 ring-offset-1' : ''}
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
  );
};

export default Calendar;