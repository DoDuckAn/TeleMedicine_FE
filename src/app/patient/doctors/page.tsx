import {Suspense} from "react";
import {DoctorsListPage} from "@/features/doctors/doctors-list-page";

export default function Page() {
  return <Suspense><DoctorsListPage patient /></Suspense>;
}
