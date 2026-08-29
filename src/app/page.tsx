import { CalendarClock, ClipboardList, Stethoscope, UsersRound } from "lucide-react";

const phases = [
  {
    title: "Phase 1",
    label: "Public",
    icon: Stethoscope,
    items: ["Trang chủ", "Đăng nhập/đăng ký", "Danh sách bác sĩ", "Chi tiết bác sĩ"],
  },
  {
    title: "Phase 2",
    label: "Patient",
    icon: CalendarClock,
    items: ["Đặt lịch", "Lịch hẹn", "Hồ sơ", "Thông báo", "Đánh giá"],
  },
  {
    title: "Phase 3",
    label: "Doctor",
    icon: ClipboardList,
    items: ["Yêu cầu khám", "Lịch làm việc", "Tư vấn", "Review", "Thống kê"],
  },
  {
    title: "Phase 4",
    label: "Admin",
    icon: UsersRound,
    items: ["Dashboard", "Bác sĩ", "Bệnh nhân", "Chuyên khoa", "Kiểm duyệt"],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen px-5 py-10 sm:px-8">
      <section className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            Telemedicine Frontend
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
            Kham Benh Tu Xa
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
            Next.js app scaffold for patient booking, doctor consultation workflows,
            and admin operations. The detailed implementation roadmap is stored in
            FRONTEND_PLAN.md.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {phases.map((phase) => {
            const Icon = phase.icon;

            return (
              <article
                key={phase.title}
                className="rounded-lg border border-border bg-white p-5 shadow-soft"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {phase.title}
                    </p>
                    <h2 className="text-lg font-semibold">{phase.label}</h2>
                  </div>
                </div>

                <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                  {phase.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

