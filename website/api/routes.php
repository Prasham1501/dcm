<?php
declare(strict_types=1);

// Instantiate controllers
$pub      = new PublicController();
$auth     = new AuthController();
$lic      = new LicenseController();
$dev      = new DeviceController();
$wallet   = new WalletController();
$invoice  = new InvoiceController();
$ticket   = new TicketController();
$bug      = new BugController();
$team     = new TeamController();
$analytics= new AnalyticsController();
$auditCtrl= new AuditController();
$apiKey   = new ApiKeyController();
$referral = new ReferralController();
$chat     = new ChatController();
$contact  = new ContactController();
$download = new DownloadController();
$admin    = new AdminController();
$settings = new SettingsController();
$webhook  = new WebhookController();
$upload   = new UploadController();

// ── Public ─────────────────────────────────────────────────────────────────
$router->get( '/health',         fn($r) => $pub->health($r));
$router->get( '/public/config',  fn($r) => $pub->config($r));
$router->get( '/setup',          fn($r) => $pub->setupForm($r));
$router->post('/setup',          fn($r) => $pub->setup($r));

// ── Auth ───────────────────────────────────────────────────────────────────
$router->post('/auth/signup',        fn($r) => $auth->signup($r));
$router->post('/auth/login',         fn($r) => $auth->login($r));
$router->post('/auth/google',        fn($r) => $auth->google($r));
$router->post('/auth/logout',        fn($r) => $auth->logout($r),         ['auth']);
$router->get( '/me',                 fn($r) => $auth->me($r),              ['auth']);
$router->patch('/me',                fn($r) => $auth->updateProfile($r),   ['auth']);
$router->post('/auth/change-password', fn($r) => $auth->changePassword($r), ['auth']);
$router->post('/auth/forgot',        fn($r) => $auth->forgot($r));
$router->post('/auth/reset',         fn($r) => $auth->reset($r));
$router->post('/auth/verify-email',  fn($r) => $auth->verifyEmail($r));
$router->post('/auth/resend-verify', fn($r) => $auth->resendVerify($r),    ['auth']);

// ── Devices ────────────────────────────────────────────────────────────────
$router->get( '/devices',              fn($r) => $dev->index($r),       ['auth']);
$router->post('/devices/{id}/deactivate', fn($r) => $dev->deactivate($r), ['auth']);

// ── Licenses (dashboard) ───────────────────────────────────────────────────
$router->get( '/licenses',         fn($r) => $lic->index($r),   ['auth']);
$router->post('/licenses/order',   fn($r) => $lic->order($r),   ['auth']);
$router->post('/licenses/verify',  fn($r) => $lic->verify($r),  ['auth']);

// ── Licenses (EXE — no JWT) ────────────────────────────────────────────────
$router->post('/license/activate',   fn($r) => $lic->activate($r));
$router->post('/license/validate',   fn($r) => $lic->validate($r));
$router->post('/license/heartbeat',  fn($r) => $lic->heartbeat($r));
$router->post('/license/deactivate', fn($r) => $lic->deactivateKey($r));

// ── Wallet ─────────────────────────────────────────────────────────────────
$router->get( '/wallet',         fn($r) => $wallet->index($r),  ['auth']);
$router->post('/wallet/topup',   fn($r) => $wallet->topup($r),  ['auth']);
$router->post('/wallet/verify',  fn($r) => $wallet->verify($r), ['auth']);
$router->post('/wallet/auto',    fn($r) => $wallet->auto($r),   ['auth']);
$router->post('/wallet/spend',   fn($r) => $wallet->spend($r));  // EXE, no JWT

// ── Invoices ───────────────────────────────────────────────────────────────
$router->get('/invoices',          fn($r) => $invoice->index($r), ['auth']);
$router->get('/invoices/{id}/pdf', fn($r) => $invoice->pdf($r),   ['auth']);

// ── Tickets ────────────────────────────────────────────────────────────────
$router->get( '/tickets',              fn($r) => $ticket->index($r),   ['auth']);
$router->post('/tickets',              fn($r) => $ticket->create($r),  ['auth']);
$router->post('/tickets/{id}/reply',   fn($r) => $ticket->reply($r),   ['auth']);
$router->post('/tickets/{id}/close',   fn($r) => $ticket->close($r),   ['auth']);

// ── Bugs ───────────────────────────────────────────────────────────────────
$router->get( '/bugs',  fn($r) => $bug->index($r),  ['auth']);
$router->post('/bugs',  fn($r) => $bug->create($r), ['auth']);

// ── Team ───────────────────────────────────────────────────────────────────
$router->get(   '/team',            fn($r) => $team->index($r),      ['auth']);
$router->post(  '/team/invite',     fn($r) => $team->invite($r),     ['auth']);
$router->post(  '/team/accept',     fn($r) => $team->accept($r));
$router->delete('/team/{id}',       fn($r) => $team->remove($r),     ['auth']);
$router->patch( '/team/{id}/role',  fn($r) => $team->updateRole($r), ['auth']);

// ── Analytics + Audit ──────────────────────────────────────────────────────
$router->get('/analytics', fn($r) => $analytics->index($r), ['auth']);
$router->get('/audit',     fn($r) => $auditCtrl->index($r), ['auth']);

// ── API Keys ───────────────────────────────────────────────────────────────
$router->get(   '/api-keys',      fn($r) => $apiKey->index($r),  ['auth']);
$router->post(  '/api-keys',      fn($r) => $apiKey->create($r), ['auth']);
$router->delete('/api-keys/{id}', fn($r) => $apiKey->delete($r), ['auth']);

// ── Referrals ──────────────────────────────────────────────────────────────
$router->get('/referrals', fn($r) => $referral->index($r), ['auth']);

// ── Chat ───────────────────────────────────────────────────────────────────
$router->post('/chat', fn($r) => $chat->send($r), ['auth']);

// ── Contact ────────────────────────────────────────────────────────────────
$router->post('/contact', fn($r) => $contact->submit($r));

// ── Download ───────────────────────────────────────────────────────────────
$router->get('/download/exe',     fn($r) => $download->exe($r));
$router->get('/download/version', fn($r) => $download->version($r));

// ── Uploads ────────────────────────────────────────────────────────────────
$router->post('/upload', fn($r) => $upload->store($r), ['auth']);

// ── Webhooks ───────────────────────────────────────────────────────────────
$router->post('/webhooks/razorpay', fn($r) => $webhook->razorpay($r));

// ── Settings (user-facing) ─────────────────────────────────────────────────
$router->get( '/settings', fn($r) => $settings->index($r), ['auth']);
$router->post('/settings', fn($r) => $settings->update($r),['auth']);

// ── Admin (super_admin only) ───────────────────────────────────────────────
$router->get( '/admin/overview',                   fn($r) => $admin->overview($r),                 ['auth','admin']);
$router->get( '/admin/accounts',                   fn($r) => $admin->accounts($r),                 ['auth','admin']);
$router->get( '/admin/licenses',                   fn($r) => $admin->licenses($r),                 ['auth','admin']);
$router->post('/admin/licenses/{id}/revoke',       fn($r) => $admin->revokeLicense($r),            ['auth','admin']);
$router->get( '/admin/payments',                   fn($r) => $admin->payments($r),                 ['auth','admin']);
$router->get( '/admin/invoices',                   fn($r) => $admin->invoices($r),                 ['auth','admin']);
$router->post('/admin/invoices/{id}/mark-paid',    fn($r) => $admin->markInvoicePaid($r),          ['auth','admin']);
$router->get( '/admin/tickets',                    fn($r) => $admin->tickets($r),                  ['auth','admin']);
$router->post('/admin/tickets/{id}/reply',         fn($r) => $admin->replyTicket($r),              ['auth','admin']);
$router->get( '/admin/audit',                      fn($r) => $admin->audit($r),                    ['auth','admin']);
$router->get( '/admin/settings',                   fn($r) => $admin->getSettings($r),              ['auth','admin']);
$router->post('/admin/settings',                   fn($r) => $admin->saveSettings($r),             ['auth','admin']);
$router->post('/admin/test-smtp',                  fn($r) => $admin->testSmtp($r),                 ['auth','admin']);
$router->post('/admin/test-razorpay',              fn($r) => $admin->testRazorpay($r),             ['auth','admin']);
$router->post('/admin/test-gemini',                fn($r) => $admin->testGemini($r),               ['auth','admin']);
$router->post('/admin/impersonate/{id}',           fn($r) => $admin->impersonate($r),              ['auth','admin']);
