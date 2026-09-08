"use client";

import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  Ref,
} from "react";
import DatePicker from "react-datepicker";
import {
  endOfDay,
  format,
  isSameDay,
  isValid,
  parseISO,
  startOfDay,
} from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";

type FieldProps = {
  error?: string;
  hint?: string;
  label: string;
};

export function Field({
  children,
  error,
  hint,
  label,
}: FieldProps & { children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <span className="mt-1.5 block">{children}</span>
      {error ? (
        <span className="mt-1 block text-sm text-red-600">{error}</span>
      ) : null}
      {!error && hint ? (
        <span className="mt-1 block text-sm text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({
  className,
  onDateChange,
  onDateBlur,
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  onDateChange?: (value: string) => void;
  onDateBlur?: () => void;
  ref?: Ref<HTMLInputElement>;
}) {
  const inputClassName = cn(
    "h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-blue-100",
    className,
  );
  if (props.type === "date" || props.type === "datetime-local") {
    const withTime = props.type === "datetime-local";
    const selected = props.value ? parseISO(String(props.value)) : null;
    const minDate = props.min ? parseISO(String(props.min)) : undefined;
    const maxDate = props.max ? parseISO(String(props.max)) : undefined;
    return (
      <DatePicker
        ref={(picker) => {
          const input =
            picker?.input instanceof HTMLInputElement ? picker.input : null;
          if (typeof ref === "function") ref(input);
          else if (ref) ref.current = input;
        }}
        selected={selected && isValid(selected) ? selected : null}
        onChange={(date: Date | null) =>
          onDateChange?.(
            date
              ? format(date, withTime ? "yyyy-MM-dd'T'HH:mm" : "yyyy-MM-dd")
              : "",
          )
        }
        onBlur={onDateBlur}
        locale={vi}
        dateFormat={withTime ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy"}
        placeholderText={withTime ? "dd/mm/yyyy hh:mm" : "dd/mm/yyyy"}
        strictParsing
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        showTimeSelect={withTime}
        timeFormat="HH:mm"
        timeCaption="Giờ"
        timeIntervals={
          props.step && props.step !== "any"
            ? Number(props.step) / 60
            : withTime
              ? 30
              : 1
        }
        minDate={minDate}
        maxDate={maxDate}
        minTime={
          withTime && (minDate || maxDate)
            ? minDate && selected && isSameDay(selected, minDate)
              ? minDate
              : startOfDay(selected ?? new Date())
            : undefined
        }
        maxTime={
          withTime && (minDate || maxDate)
            ? maxDate && selected && isSameDay(selected, maxDate)
              ? maxDate
              : endOfDay(selected ?? new Date())
            : undefined
        }
        disabled={props.disabled}
        readOnly={props.readOnly}
        required={props.required}
        id={props.id}
        name={props.name}
        ariaLabel={props["aria-label"]}
        ariaInvalid={
          props["aria-invalid"] === undefined
            ? undefined
            : String(props["aria-invalid"])
        }
        ariaDescribedBy={props["aria-describedby"]}
        autoComplete="off"
        className={inputClassName}
        wrapperClassName="date-picker-field"
        calendarClassName="vi-calendar"
        popperClassName="vi-date-popper"
        popperPlacement="bottom"
        showIcon
        icon={<CalendarDays />}
        toggleCalendarOnIconClick
        previousMonthAriaLabel="Tháng trước"
        nextMonthAriaLabel="Tháng sau"
        monthAriaLabelPrefix="Tháng"
        isClearable={!props.required}
        clearButtonTitle="Xóa ngày"
        ariaLabelClose="Xóa ngày"
      />
    );
  }
  return <input ref={ref} className={inputClassName} {...props} />;
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-blue-100",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-blue-100",
        className,
      )}
      {...props}
    />
  );
}
