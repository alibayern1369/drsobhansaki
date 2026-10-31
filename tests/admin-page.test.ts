import test, { mock } from "node:test";
import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import type { ReactElement } from "react";

test("administrator page offers password sign-in for patient sessions and preserves MFA", async (t) => {
  type Auth = {
    user: { role: string };
    credential: { smsEnabled: boolean; totpEnabled: boolean } | null;
    passwordVerified: boolean;
    mfaVerifiedAt: Date | null;
  };
  let auth: Auth | null = null;
  const AdminLogin = () => null;
  const AdminPanel = () => null;
  const loader = Module as unknown as {
    _load: (id: string, ...args: unknown[]) => unknown;
  };
  const originalLoad = loader._load;
  const loadMock = mock.method(loader, "_load", function (
    this: typeof loader,
    id: string,
    ...args: unknown[]
  ) {
    if (id === "@/server/security")
      return {
        currentUser: async () => auth,
        isMfaCurrent: (date: Date | null) =>
          !!date && date.getTime() > Date.now() - 15 * 60 * 1000,
      };
    if (id === "@/components/admin-login") return { AdminLogin };
    if (id === "@/components/admin-panel") return { AdminPanel };
    return originalLoad.call(this, id, ...args);
  });
  let Page: typeof import("../src/app/[locale]/admin/page").default;
  try {
    Page = createRequire(import.meta.url)("../src/app/[locale]/admin/page").default;
  } finally {
    loadMock.mock.restore();
  }
  async function view(locale = "fa") {
    const page = await Page({ params: Promise.resolve({ locale }) });
    return page.props.children as ReactElement<{
      locale: string;
      mfaRequired: boolean;
      passwordLogin: boolean;
    }>;
  }
  await t.test("anonymous visitors can sign in", async () => {
    assert.equal((await view()).type, AdminLogin);
  });
  for (const role of ["patient", "unknown", "doctor", "staff", "super_admin"]) {
    await t.test(`${role} sessions retain the appropriate access checks`, async () => {
      auth = {
        user: { role },
        credential: null,
        passwordVerified: false,
        mfaVerifiedAt: null,
      };
      const privileged = ["doctor", "staff", "super_admin"].includes(role);
      for (const locale of ["fa", "en"]) {
        const child = await view(locale);
        assert.equal(child.type, privileged ? AdminPanel : AdminLogin);
        assert.equal(child.props.locale, locale);
        if (privileged) assert.equal(child.props.mfaRequired, true);
      }
      auth.credential = { smsEnabled: true, totpEnabled: true };
      assert.equal((await view()).type, AdminLogin);
      auth.passwordVerified = true;
      const child = await view();
      assert.equal(child.type, privileged ? AdminPanel : AdminLogin);
      if (privileged) {
        assert.equal(child.props.mfaRequired, true);
        auth.mfaVerifiedAt = new Date();
        assert.equal((await view()).props.mfaRequired, false);
      }
    });
  }
});
