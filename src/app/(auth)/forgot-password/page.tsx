import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request a password reset link for your CodeMentor AI account.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
