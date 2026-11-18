import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { verifyEmailApi } from "../api/authApi";
import SEO from "../../../components/SEO";

export default function VerifyEmailPage() {
  const { token } = useParams();
  const [status, setStatus] = useState("verifying");

  useEffect(() => {
    let active = true;

    verifyEmailApi(token)
      .then(() => {
        if (!active) return;
        setStatus("success");
        toast.success("Email verified successfully");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="mx-auto my-16 max-w-md rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
      <SEO title="Verify Email | Qala" description="Verify your Qala customer account email address." noindex />
      {status === "verifying" && <p className="text-neutral-600">Verifying your email address...</p>}
      {status === "success" && (
        <>
          <h1 className="mb-3 text-2xl font-serif font-bold">Email verified</h1>
          <p className="mb-6 text-neutral-600">Your Qala account is ready. You can now sign in.</p>
          <Link to="/login" className="inline-block rounded bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800">
            Continue to sign in
          </Link>
        </>
      )}
      {status === "error" && (
        <>
          <h1 className="mb-3 text-2xl font-serif font-bold">Verification link unavailable</h1>
          <p className="mb-6 text-neutral-600">This link is invalid or has expired. Request a new verification email from the sign-in page.</p>
          <Link to="/login" className="inline-block rounded bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800">
            Return to sign in
          </Link>
        </>
      )}
    </div>
  );
}
