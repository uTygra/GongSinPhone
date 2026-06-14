This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## AMAPI PoC recovery

If the test phone says "기기를 설정할 수 없음. 조직의 사용 한도에 도달..." during QR provisioning, reset the PoC enrollment state before issuing another QR:

```bash
npm run poc:diagnose
npm run poc:cleanup
npm run poc:enroll
```

If `poc:diagnose` shows `등록된 기기: 0개` but the phone still shows the organization usage-limit error, create a fresh Android Enterprise binding and issue a new QR:

```bash
npm run poc:delete-enterprise -- --yes
npm run poc:setup:new
npm run poc:enroll
```

Notes:

- `poc:diagnose` checks the current enterprise, policies, active enrollment tokens, and enrolled devices.
- `poc:cleanup` deletes stale enrollment tokens and enrolled AMAPI devices for the PoC enterprise.
- `poc:delete-enterprise` deletes the current Android Enterprise binding and removes it from `.env.local`.
- `poc:setup:new` ignores the saved `AMAPI_ENTERPRISE_NAME` and creates a new enterprise after you complete the Google signup URL flow.
- After scanning the QR, do not press Back until provisioning finishes. Interrupted provisioning can leave server-side enrollment state behind.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
