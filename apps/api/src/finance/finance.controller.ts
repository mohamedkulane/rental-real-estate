import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PermissionGuard } from '../security/permission.guard';
import { RequirePermissions } from '../security/security.decorators';
import { SessionAuthGuard } from '../security/session-auth.guard';
import type { AuthenticatedRequest } from '../security/security.types';
import { AccountingService } from './accounting.service';
import { BillingService } from './billing.service';
import { BrokerageDealService } from './brokerage-deal.service';
import {
  AllocatePaymentDto,
  BillingScheduleQueryDto,
  BrokerageDealQueryDto,
  BrokerageDealTransitionDto,
  ChargeQueryDto,
  CreateBillingScheduleDto,
  CreateBrokerageDealDto,
  CreateExpenseDto,
  CreateJournalDto,
  CreateOwnerPayoutDto,
  CreatePaymentDto,
  CreateSaleOfferDto,
  CreateSaleSettlementDto,
  ExpenseQueryDto,
  ExpenseTransitionDto,
  FinanceBranchQueryDto,
  InvoiceQueryDto,
  IssueInvoiceDto,
  JournalQueryDto,
  OwnerPayoutQueryDto,
  OwnerPayoutTransitionDto,
  PaymentQueryDto,
  ReverseJournalDto,
  RunBillingDto,
  SaleOfferQueryDto,
  SaleOfferTransitionDto,
  SaleSettlementQueryDto,
  SaleSettlementTransitionDto,
} from './finance.dto';
import { ExpenseService } from './expense.service';
import { FinanceOverviewService } from './finance-overview.service';
import { OwnerPayoutService } from './owner-payout.service';
import { PaymentService } from './payment.service';
import { SaleOfferService } from './sale-offer.service';
import { SaleSettlementService } from './sale-settlement.service';

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'billing-schedules', version: '1' })
export class BillingScheduleController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @RequirePermissions('billing.read')
  list(@Req() req: AuthenticatedRequest, @Query() query: BillingScheduleQueryDto) {
    return this.billing.listSchedules(req.principal, query);
  }

  @Post()
  @RequirePermissions('billing.manage')
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateBillingScheduleDto) {
    return this.billing.createSchedule(req.principal, input, req.correlationId);
  }

  @Post('run')
  @RequirePermissions('billing.manage')
  run(@Req() req: AuthenticatedRequest, @Body() input: RunBillingDto) {
    return this.billing.runBilling(req.principal, input, req.correlationId);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'charges', version: '1' })
export class ChargeController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @RequirePermissions('billing.read')
  list(@Req() req: AuthenticatedRequest, @Query() query: ChargeQueryDto) {
    return this.billing.listCharges(req.principal, query);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'invoices', version: '1' })
export class InvoiceController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @RequirePermissions('invoice.read')
  list(@Req() req: AuthenticatedRequest, @Query() query: InvoiceQueryDto) {
    return this.billing.listInvoices(req.principal, query);
  }

  @Get(':id')
  @RequirePermissions('invoice.read')
  get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.billing.getInvoice(req.principal, id);
  }

  @Post()
  @RequirePermissions('invoice.manage')
  issue(@Req() req: AuthenticatedRequest, @Body() input: IssueInvoiceDto) {
    return this.billing.issueInvoice(req.principal, input, req.correlationId);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'payments', version: '1' })
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Get()
  @RequirePermissions('payment.read')
  list(@Req() req: AuthenticatedRequest, @Query() query: PaymentQueryDto) {
    return this.payments.list(req.principal, query);
  }

  @Get(':id')
  @RequirePermissions('payment.read')
  get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.get(req.principal, id);
  }

  @Post()
  @RequirePermissions('payment.create')
  create(@Req() req: AuthenticatedRequest, @Body() input: CreatePaymentDto) {
    return this.payments.create(req.principal, input, req.correlationId);
  }

  @Post(':id/allocate')
  @RequirePermissions('payment.allocate')
  allocate(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AllocatePaymentDto,
  ) {
    return this.payments.allocate(req.principal, id, input, req.correlationId);
  }

  @Post(':id/receipt')
  @RequirePermissions('payment.create')
  receipt(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.issueReceipt(req.principal, id, req.correlationId);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'expenses', version: '1' })
export class ExpenseController {
  constructor(private readonly expenses: ExpenseService) {}

  @Get()
  @RequirePermissions('expense.read')
  list(@Req() req: AuthenticatedRequest, @Query() query: ExpenseQueryDto) {
    return this.expenses.list(req.principal, query);
  }

  @Get(':id')
  @RequirePermissions('expense.read')
  get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.expenses.get(req.principal, id);
  }

  @Post()
  @RequirePermissions('expense.manage')
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateExpenseDto) {
    return this.expenses.create(req.principal, input, req.correlationId);
  }

  @Post(':id/transition')
  @RequirePermissions('expense.manage')
  transition(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ExpenseTransitionDto,
  ) {
    return this.expenses.transition(req.principal, id, input, req.correlationId);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'owner-payouts', version: '1' })
export class OwnerPayoutController {
  constructor(private readonly payouts: OwnerPayoutService) {}

  @Get()
  @RequirePermissions('payout.read')
  list(@Req() req: AuthenticatedRequest, @Query() query: OwnerPayoutQueryDto) {
    return this.payouts.list(req.principal, query);
  }

  @Get(':id')
  @RequirePermissions('payout.read')
  get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.payouts.get(req.principal, id);
  }

  @Post()
  @RequirePermissions('payout.manage')
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateOwnerPayoutDto) {
    return this.payouts.create(req.principal, input, req.correlationId);
  }

  @Post(':id/transition')
  @RequirePermissions('payout.manage')
  transition(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: OwnerPayoutTransitionDto,
  ) {
    return this.payouts.transition(req.principal, id, input, req.correlationId);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'journals', version: '1' })
export class JournalController {
  constructor(private readonly accounting: AccountingService) {}

  @Get()
  @RequirePermissions('journal.read')
  list(@Req() req: AuthenticatedRequest, @Query() query: JournalQueryDto) {
    return this.accounting.list(req.principal, query);
  }

  @Get(':id')
  @RequirePermissions('journal.read')
  get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.accounting.get(req.principal, id);
  }

  @Post()
  @RequirePermissions('journal.manage')
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateJournalDto) {
    return this.accounting.create(req.principal, input, req.correlationId);
  }

  @Post(':id/post')
  @RequirePermissions('journal.manage')
  post(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.accounting.post(req.principal, id, req.correlationId);
  }

  @Post(':id/reverse')
  @RequirePermissions('journal.manage')
  reverse(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ReverseJournalDto,
  ) {
    return this.accounting.reverse(req.principal, id, input, req.correlationId);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'finance/overview', version: '1' })
export class FinanceOverviewController {
  constructor(private readonly overview: FinanceOverviewService) {}

  @Get()
  @RequirePermissions('finance.overview.read')
  get(@Req() req: AuthenticatedRequest) {
    return this.overview.overview(req.principal);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'owner-statements', version: '1' })
export class OwnerStatementController {
  constructor(private readonly overview: FinanceOverviewService) {}

  @Get()
  @RequirePermissions('owner-statement.read')
  list(@Req() req: AuthenticatedRequest, @Query() query: FinanceBranchQueryDto) {
    return this.overview.listOwnerStatements(req.principal, query);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'brokerage-deals', version: '1' })
export class BrokerageDealController {
  constructor(private readonly deals: BrokerageDealService) {}

  @Get()
  @RequirePermissions('brokerage-deal.read')
  list(@Req() req: AuthenticatedRequest, @Query() query: BrokerageDealQueryDto) {
    return this.deals.list(req.principal, query);
  }

  @Get(':id')
  @RequirePermissions('brokerage-deal.read')
  get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.deals.get(req.principal, id);
  }

  @Post()
  @RequirePermissions('brokerage-deal.manage')
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateBrokerageDealDto) {
    return this.deals.create(req.principal, input, req.correlationId);
  }

  @Post(':id/transition')
  @RequirePermissions('brokerage-deal.manage')
  transition(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: BrokerageDealTransitionDto,
  ) {
    return this.deals.transition(req.principal, id, input, req.correlationId);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'sale-offers', version: '1' })
export class SaleOfferController {
  constructor(private readonly offers: SaleOfferService) {}

  @Get()
  @RequirePermissions('sale-offer.read')
  list(@Req() req: AuthenticatedRequest, @Query() query: SaleOfferQueryDto) {
    return this.offers.list(req.principal, query);
  }

  @Get(':id')
  @RequirePermissions('sale-offer.read')
  get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.offers.get(req.principal, id);
  }

  @Post()
  @RequirePermissions('sale-offer.manage')
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateSaleOfferDto) {
    return this.offers.create(req.principal, input, req.correlationId);
  }

  @Post(':id/transition')
  @RequirePermissions('sale-offer.manage')
  transition(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SaleOfferTransitionDto,
  ) {
    return this.offers.transition(req.principal, id, input, req.correlationId);
  }
}

@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller({ path: 'sale-settlements', version: '1' })
export class SaleSettlementController {
  constructor(private readonly settlements: SaleSettlementService) {}

  @Get()
  @RequirePermissions('sale-settlement.read')
  list(@Req() req: AuthenticatedRequest, @Query() query: SaleSettlementQueryDto) {
    return this.settlements.list(req.principal, query);
  }

  @Get(':id')
  @RequirePermissions('sale-settlement.read')
  get(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.settlements.get(req.principal, id);
  }

  @Post()
  @RequirePermissions('sale-settlement.manage')
  create(@Req() req: AuthenticatedRequest, @Body() input: CreateSaleSettlementDto) {
    return this.settlements.create(req.principal, input, req.correlationId);
  }

  @Post(':id/transition')
  @RequirePermissions('sale-settlement.manage')
  transition(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SaleSettlementTransitionDto,
  ) {
    return this.settlements.transition(req.principal, id, input, req.correlationId);
  }
}
