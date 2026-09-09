"use client";

import { useState } from "react";
import DatePicker from "react-datepicker";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { formatDate, formatTime, formatTimeRange } from "@/lib/format";
import type { DoctorAvailabilityDay } from "@/types/api";

export function AvailabilityView({ days }: { days: DoctorAvailabilityDay[] }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const activeDay =
    days.find((day) => day.date === selectedDate) ??
    days.find((day) => day.slots.length > 0) ??
    days[0];
  if (!activeDay)
    return (
      <p className="py-4 text-sm text-slate-600">
        Chưa có lịch trống trong 7 ngày tới.
      </p>
    );
  const groups = [
    {
      label: "Buổi sáng",
      slots: activeDay.slots.filter(
        (slot) => Number(formatTime(slot.startAt).slice(0, 2)) < 12,
      ),
    },
    {
      label: "Buổi chiều",
      slots: activeDay.slots.filter(
        (slot) => Number(formatTime(slot.startAt).slice(0, 2)) >= 12,
      ),
    },
  ];
  return (
    <div className="grid items-start gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
      <div className="booking-calendar min-w-0">
        <h3 className="mb-3 font-semibold">Chọn ngày khám</h3>
        <DatePicker
          inline
          locale={vi}
          selected={parseISO(activeDay.date)}
          onChange={(date: Date | null) => {
            if (date) setSelectedDate(format(date, "yyyy-MM-dd"));
          }}
          includeDates={days
            .filter((day) => day.slots.length > 0)
            .map((day) => parseISO(day.date))}
          minDate={parseISO(days[0].date)}
          maxDate={parseISO(days[days.length - 1].date)}
          calendarClassName="vi-calendar"
          previousMonthAriaLabel="Tháng trước"
          nextMonthAriaLabel="Tháng sau"
        />
      </div>
      <div className="min-w-0" aria-live="polite">
        <h3 className="mb-3 font-semibold">
          Khung giờ {formatDate(activeDay.date + "T00:00:00+07:00")}
        </h3>
        <div
          className="max-h-80 space-y-5 overflow-y-auto pr-2"
          tabIndex={0}
          role="region"
          aria-label="Khung giờ trống"
        >
          {groups.map((group) => (
            <div key={group.label}>
              <h4 className="mb-2 text-sm font-semibold text-slate-700">
                {group.label}
              </h4>
              {group.slots.length ? (
                <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                  {group.slots.map((slot) => (
                    <span
                      key={slot.startAt}
                      className="flex min-h-11 items-center justify-center rounded border border-slate-300 bg-slate-100 px-2 py-2 text-center text-sm font-semibold text-slate-700"
                    >
                      {formatTimeRange(slot.startAt, slot.endAt)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="py-2 text-sm text-slate-500">
                  Không còn khung giờ trống.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
