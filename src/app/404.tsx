"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getBasePath } from "@/utils/basePath";

export default function Custom404() {
  const router = useRouter();
  const basePath = getBasePath();

  useEffect(() => {
    // When a 404 occurs, try to redirect to the homepage
    router.replace(basePath || "/");
  }, [router, basePath]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Page Not Found</h1>
        <p>Redirecting to home page...</p>
      </div>
    </div>
  );
}
