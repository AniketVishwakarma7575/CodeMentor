import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a CodeMentor AI account.",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
