"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/workspace";
import { Logo } from "@/components/icons";
import { Spinner } from "@/components/ui";
import { NewBoardForm } from "@/components/BoardLogo";

export default function Home() {
  const { boards, me, isAdmin } = useWorkspace();
  const router = useRouter();

  useEffect(() => {
    if (boards.length) router.replace(`/board/${boards[0].id}`);
  }, [boards, router]);

  if (boards.length) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <Logo className="mx-auto mb-4 h-12 w-12" />
          <h1 className="text-2xl font-semibold">Welcome, {me.full_name.split(" ")[0]}</h1>
          <p className="mt-2 text-sm text-muted">
            You haven&apos;t been added to a project yet. Ask your admin to add you, and it will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <Logo className="mx-auto mb-4 h-12 w-12" />
        <h1 className="text-2xl font-semibold">Welcome, {me.full_name.split(" ")[0]}</h1>
        <p className="mt-2 text-sm text-muted">
          Create your first project. Use one project per brand and type of work.
        </p>
        <div className="mt-6 rounded-3xl bg-panel/90 p-6 shadow-card backdrop-blur">
          <NewBoardForm />
        </div>
      </div>
    </div>
  );
}
