import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  cloneWeeklySchedule,
  nextDefaultRange,
  weekdayLabels,
  weekdays,
} from "@/lib/doctor-schedule";
import type { Weekday, WeeklySchedule, WeeklyScheduleRange } from "@/types/api";

export function AdminWeeklyScheduleEditor({
  onChange,
  schedule,
}: {
  onChange: (schedule: WeeklySchedule) => void;
  schedule: WeeklySchedule;
}) {
  function updateRange(
    weekday: Weekday,
    index: number,
    field: keyof WeeklyScheduleRange,
    value: string,
  ) {
    const next = cloneWeeklySchedule(schedule);
    next[weekday] = next[weekday].map((range, rangeIndex) =>
      rangeIndex === index ? { ...range, [field]: value } : range,
    );
    onChange(next);
  }

  function addRange(weekday: Weekday) {
    const next = cloneWeeklySchedule(schedule);
    next[weekday] = [...next[weekday], nextDefaultRange(next[weekday])];
    onChange(next);
  }

  function removeRange(weekday: Weekday, index: number) {
    const next = cloneWeeklySchedule(schedule);
    next[weekday] = next[weekday].filter(
      (_, rangeIndex) => rangeIndex !== index,
    );
    onChange(next);
  }

  return (
    <div className="grid gap-3">
      {weekdays.map((weekday) => (
        <div
          className="rounded-lg border border-blue-100 bg-slate-50 p-4"
          key={weekday}
        >
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-bold text-slate-900">
                {weekdayLabels[weekday]}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {schedule[weekday].length
                  ? `${schedule[weekday].length} khoảng`
                  : "Nghỉ"}
              </p>
            </div>
            <Button
              onClick={() => addRange(weekday)}
              size="sm"
              variant="outline"
            >
              <Plus aria-hidden="true" className="size-4" />
              Thêm giờ
            </Button>
          </div>

          {schedule[weekday].length ? (
            <div className="mt-3 grid gap-3">
              {schedule[weekday].map((range, index) => (
                <div
                  className="grid gap-3 rounded-lg border border-blue-100 bg-white p-3 sm:grid-cols-[1fr_1fr_auto]"
                  key={`${weekday}-${index}`}
                >
                  <Field label="Bắt đầu">
                    <Input
                      onChange={(event) =>
                        updateRange(
                          weekday,
                          index,
                          "startTime",
                          event.target.value,
                        )
                      }
                      type="time"
                      value={range.startTime}
                    />
                  </Field>
                  <Field label="Kết thúc">
                    <Input
                      onChange={(event) =>
                        updateRange(
                          weekday,
                          index,
                          "endTime",
                          event.target.value,
                        )
                      }
                      type="time"
                      value={range.endTime}
                    />
                  </Field>
                  <Button
                    className="self-end"
                    onClick={() => removeRange(weekday, index)}
                    size="sm"
                    variant="outline"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    Xóa
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
