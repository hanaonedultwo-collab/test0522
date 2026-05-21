import { useEffect, useMemo, useState } from "react";
import { computeChart } from "@/modules/chart/manseryeok.adapter";
import {
  llmModels,
  productsByService,
  serviceIds,
  type LlmModel,
  type ProductId,
  type ServiceId,
  type TemplateConfig,
} from "@/modules/orders/order.types";

type ViewKey = "대시보드" | "주문 관리" | "고객 관리" | "템플릿 설정" | "크레딧 충전";

type FormState = {
  customerName: string;
  customerEmail: string;
  gender: "남성" | "여성" | "기타";
  serviceId: ServiceId;
  productId: ProductId;
  llmModel: LlmModel;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  birthTimeUnknown: boolean;
  calendarType: "solar" | "lunar";
  isLeapMonth: boolean;
  additionalQuestion: string;
};

type DashboardOrder = {
  id: string;
  customerName: string;
  customerEmail: string;
  serviceId: ServiceId;
  productId: ProductId;
  llmModel: LlmModel;
  status: "대기중" | "처리중" | "완료" | "실패";
  createdAt: string;
  chart: ReturnType<typeof computeChart>;
  analysis: Array<{ title: string; content: string }>;
};

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  credits: number;
};

const menuItems: ViewKey[] = ["대시보드", "주문 관리", "고객 관리", "템플릿 설정", "크레딧 충전"];

const INITIAL_FORM: FormState = {
  customerName: "신예진",
  customerEmail: "user@example.com",
  gender: "여성",
  serviceId: "serviceA",
  productId: "general",
  llmModel: "gemini-3",
  year: 1989,
  month: 2,
  day: 3,
  hour: 6,
  minute: 0,
  birthTimeUnknown: false,
  calendarType: "solar",
  isLeapMonth: false,
  additionalQuestion: "올해 직업운과 재물운 중심으로 보고 싶어요.",
};

const defaultTemplates: TemplateConfig[] = [
  {
    serviceId: "serviceA",
    productId: "general",
    coverTemplate: "serviceA_general",
    innerTemplate: "serviceA_general",
    promptOverall: "사주A 톤으로 종합운을 구조적으로 작성",
    promptWealth: "재물운은 리스크/현금흐름/저축 루틴을 포함",
    promptCareer: "직업운은 실행 전략과 시기 제안 포함",
  },
];

const serviceNameMap: Record<ServiceId, string> = {
  serviceA: "사주A",
  serviceB: "사주B",
  serviceC: "사주C",
};

const productNameMap: Record<ProductId, string> = {
  general: "종합운",
  love: "연애운",
  premium: "프리미엄",
  career: "직업운",
  match: "궁합",
  yearly: "연운",
};

export default function App() {
  const [currentView, setCurrentView] = useState<ViewKey>("대시보드");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateConfig[]>(defaultTemplates);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [creditUserId, setCreditUserId] = useState<string>("");
  const [creditAmount, setCreditAmount] = useState(1000);
  const [userId] = useState(() => crypto.randomUUID());

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  const stats = useMemo(() => {
    const total = orders.length;
    return {
      total,
      waiting: orders.filter((order) => order.status === "대기중").length,
      processing: orders.filter((order) => order.status === "처리중").length,
      completed: orders.filter((order) => order.status === "완료").length,
      failed: orders.filter((order) => order.status === "실패").length,
    };
  }, [orders]);

  useEffect(() => {
    void refreshOrders();
    void refreshCustomers();
    void refreshTemplates();
  }, []);

  async function refreshOrders() {
    try {
      const response = await fetch("/api/v1/orders");

      if (!response.ok) {
        return;
      }

      const json = (await response.json()) as {
        data?: Array<{
          order: {
            id: string;
            customerName: string;
            customerEmail: string;
            serviceId: ServiceId;
            productId: ProductId;
            llmModel: LlmModel;
            createdAt: string;
            status: string;
          };
          chart: {
            rawResult: Record<string, unknown>;
            sajuPillars: { year: string; month: string; day: string; hour: string | null };
          };
          sections: Array<{ title: string; content?: string }>;
        }>;
      };

      if (!json.data) {
        return;
      }

      const mapped = json.data.map((bundle) => {
        const reconstructed = computeChart({
          year: Number((bundle.chart.rawResult.solarDate as { year?: number })?.year ?? 1989),
          month: Number((bundle.chart.rawResult.solarDate as { month?: number })?.month ?? 2),
          day: Number((bundle.chart.rawResult.solarDate as { day?: number })?.day ?? 3),
          birthTimeUnknown: !bundle.chart.sajuPillars.hour,
          calendarType: "solar",
        });

        return {
          id: bundle.order.id,
          customerName: bundle.order.customerName,
          customerEmail: bundle.order.customerEmail,
          serviceId: bundle.order.serviceId,
          productId: bundle.order.productId,
          llmModel: bundle.order.llmModel,
          status: toUiStatus(bundle.order.status),
          createdAt: bundle.order.createdAt,
          chart: reconstructed,
          analysis: bundle.sections.map((section) => ({
            title: section.title,
            content: section.content ?? "",
          })),
        } satisfies DashboardOrder;
      });

      setOrders(mapped);
    } catch {
      // API가 없는 Vite 단독 실행 환경에서는 로컬 상태를 유지합니다.
    }
  }

  async function refreshCustomers() {
    try {
      const response = await fetch("/api/v1/customers");
      if (!response.ok) {
        return;
      }

      const json = (await response.json()) as { data?: CustomerRow[] };
      if (json.data) {
        setCustomers(json.data);
        if (!creditUserId && json.data.length > 0) {
          setCreditUserId(json.data[0].id);
        }
      }
    } catch {
      // no-op
    }
  }

  async function refreshTemplates() {
    try {
      const response = await fetch("/api/v1/templates");
      if (!response.ok) {
        return;
      }
      const json = (await response.json()) as { data?: TemplateConfig[] };
      if (json.data) {
        setTemplates(json.data);
      }
    } catch {
      // no-op
    }
  }

  async function createOrder() {
    setIsSubmitting(true);
    setNotice(null);

    const optimisticChart = computeChart({
      year: form.year,
      month: form.month,
      day: form.day,
      hour: form.birthTimeUnknown ? undefined : form.hour,
      minute: form.birthTimeUnknown ? undefined : form.minute,
      birthTimeUnknown: form.birthTimeUnknown,
      calendarType: form.calendarType,
      isLeapMonth: form.isLeapMonth,
      longitude: 127,
    });

    try {
      const createResponse = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          customerName: form.customerName,
          customerEmail: form.customerEmail,
          gender: form.gender,
          serviceId: form.serviceId,
          productId: form.productId,
          llmModel: form.llmModel,
          calendarType: form.calendarType,
          isLeapMonth: form.isLeapMonth,
          birthYear: form.year,
          birthMonth: form.month,
          birthDay: form.day,
          birthHour: form.birthTimeUnknown ? undefined : form.hour,
          birthMinute: form.birthTimeUnknown ? undefined : form.minute,
          birthTimeUnknown: form.birthTimeUnknown,
          additionalQuestion: form.additionalQuestion,
          longitude: 127,
        }),
      });

      if (!createResponse.ok) {
        throw new Error("주문 생성 실패");
      }

      const createJson = (await createResponse.json()) as { data?: { order?: { id: string } } };
      const orderId = createJson.data?.order?.id;

      if (!orderId) {
        throw new Error("주문 ID 없음");
      }

      const analyzeResponse = await fetch(`/api/v1/orders/${orderId}/analyze`, { method: "POST" });

      if (!analyzeResponse.ok) {
        throw new Error("분석 실패");
      }

      const analyzeJson = (await analyzeResponse.json()) as {
        data?: { sections?: Array<{ title: string; content?: string }> };
      };

      const newOrder: DashboardOrder = {
        id: orderId,
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        serviceId: form.serviceId,
        productId: form.productId,
        llmModel: form.llmModel,
        status: "완료",
        createdAt: new Date().toISOString(),
        chart: optimisticChart,
        analysis:
          analyzeJson.data?.sections?.map((section) => ({
            title: section.title,
            content: section.content ?? "",
          })) ?? [],
      };

      setOrders((prev) => [newOrder, ...prev]);
      setSelectedOrderId(newOrder.id);
      setShowModal(false);
      setCurrentView("대시보드");
      await refreshCustomers();
    } catch {
      const fallbackOrder: DashboardOrder = {
        id: crypto.randomUUID(),
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        serviceId: form.serviceId,
        productId: form.productId,
        llmModel: form.llmModel,
        status: "완료",
        createdAt: new Date().toISOString(),
        chart: optimisticChart,
        analysis: [
          {
            title: "종합운세",
            content: form.birthTimeUnknown
              ? "출생 시간이 없어 삼주 기준으로 분석했습니다. 올해는 보수적 접근이 유리합니다."
              : "사주 사주팔자 네 기둥 기준 분석입니다. 중반기 이후 기회가 확대됩니다.",
          },
          {
            title: "재물운",
            content: "단기 소비 관리와 분기별 자산 점검 루틴을 권장합니다.",
          },
          {
            title: "직업운",
            content: "기획/분석형 업무에서 강점이 보이며, 전환 시기는 하반기가 유리합니다.",
          },
        ],
      };

      setOrders((prev) => [fallbackOrder, ...prev]);
      setSelectedOrderId(fallbackOrder.id);
      setShowModal(false);
      setNotice("API 서버 미연결 상태로 데모 데이터가 표시되었습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function copyOrder(order: DashboardOrder) {
    const copied: DashboardOrder = {
      ...order,
      id: crypto.randomUUID(),
      status: "대기중",
      createdAt: new Date().toISOString(),
    };

    setOrders((prev) => [copied, ...prev]);
    setNotice("주문이 복사되었습니다.");
  }

  async function regenerateOrder(order: DashboardOrder) {
    setNotice(null);
    setOrders((prev) => prev.map((item) => (item.id === order.id ? { ...item, status: "처리중" } : item)));

    try {
      const response = await fetch(`/api/v1/orders/${order.id}/regenerate`, { method: "POST" });

      if (!response.ok) {
        throw new Error("재생성 실패");
      }

      const json = (await response.json()) as {
        data?: { sections?: Array<{ title: string; content?: string }> };
      };

      setOrders((prev) =>
        prev.map((item) =>
          item.id === order.id
            ? {
                ...item,
                status: "완료",
                analysis:
                  json.data?.sections?.map((section) => ({
                    title: section.title,
                    content: section.content ?? "",
                  })) ?? item.analysis,
              }
            : item
        )
      );
      setNotice("분석 결과를 재생성했습니다.");
    } catch {
      setOrders((prev) => prev.map((item) => (item.id === order.id ? { ...item, status: "완료" } : item)));
      setNotice("재생성 API가 없어 기존 결과를 유지합니다.");
    }
  }

  async function resendEmail(order: DashboardOrder) {
    try {
      const response = await fetch(`/api/v1/orders/${order.id}/resend-email`, { method: "POST" });
      if (!response.ok) {
        throw new Error("이메일 재발송 실패");
      }
      setNotice(`${order.customerName} 고객에게 이메일 재발송 완료`);
    } catch {
      setNotice("이메일 재발송 API가 연결되지 않아 시뮬레이션으로 처리했습니다.");
    }
  }

  async function chargeCredits() {
    if (!creditUserId || creditAmount <= 0) {
      return;
    }

    try {
      const response = await fetch("/api/v1/credits/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: creditUserId, amount: creditAmount }),
      });

      if (!response.ok) {
        throw new Error("충전 실패");
      }

      await refreshCustomers();
      setNotice("크레딧이 충전되었습니다.");
    } catch {
      setCustomers((prev) =>
        prev.map((customer) =>
          customer.id === creditUserId ? { ...customer, credits: customer.credits + creditAmount } : customer
        )
      );
      setNotice("크레딧 충전 API가 없어 화면에서만 반영했습니다.");
    }
  }

  function selectCustomer(customer: CustomerRow) {
    setForm((prev) => ({
      ...prev,
      customerName: customer.name,
      customerEmail: customer.email,
    }));
    setShowModal(true);
  }

  async function saveTemplateConfig(config: TemplateConfig) {
    try {
      const response = await fetch("/api/v1/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error("저장 실패");
      }

      const json = (await response.json()) as { data?: TemplateConfig };
      if (json.data) {
        setTemplates((prev) => upsertTemplate(prev, json.data!));
      }
      setNotice("템플릿/프롬프트 설정이 저장되었습니다.");
    } catch {
      setTemplates((prev) => upsertTemplate(prev, config));
      setNotice("API 미연결로 로컬 상태에만 저장했습니다.");
    }
  }

  const serviceProducts = productsByService[form.serviceId];

  return (
    <div className="min-h-screen bg-[#f4f6fb] text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-64 bg-gradient-to-b from-[#231129] to-[#130b18] px-4 py-5 text-white">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
            <p className="text-sm font-semibold">사주연구소</p>
            <p className="mt-1 text-xs text-violet-200">크레딧 운영 모드</p>
          </div>

          <nav className="mt-6 space-y-1">
            {menuItems.map((item) => (
              <button
                key={item}
                onClick={() => setCurrentView(item)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  currentView === item ? "bg-violet-600/30 text-white" : "text-white/70 hover:bg-white/5"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6">
          <header className="rounded-2xl bg-white px-6 py-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold">{currentView}</h1>
                <p className="mt-1 text-sm text-slate-500">이미지 레퍼런스 기반 운영형 관리자 화면</p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
              >
                새 주문
              </button>
            </div>
          </header>

          {notice ? <p className="mt-3 text-sm text-amber-700">{notice}</p> : null}

          {currentView === "대시보드" ? (
            <>
              <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                <StatBox label="전체" value={stats.total} tone="slate" />
                <StatBox label="대기중" value={stats.waiting} tone="amber" />
                <StatBox label="처리중" value={stats.processing} tone="blue" />
                <StatBox label="완료" value={stats.completed} tone="emerald" />
                <StatBox label="실패" value={stats.failed} tone="rose" />
              </section>

              <OrdersPanel
                orders={orders}
                onCopy={copyOrder}
                onDetail={setSelectedOrderId}
                onRegenerate={regenerateOrder}
                onResend={resendEmail}
              />

              <DetailPanel order={selectedOrder} />
            </>
          ) : null}

          {currentView === "주문 관리" ? (
            <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-3 text-lg font-semibold">전체 주문 테이블</h2>
              <OrdersTable orders={orders} onDetail={setSelectedOrderId} />
            </section>
          ) : null}

          {currentView === "고객 관리" ? (
            <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-3 text-lg font-semibold">고객 리스트</h2>
              <div className="space-y-2">
                {customers.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{customer.name}</p>
                      <p className="text-xs text-slate-500">{customer.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-slate-600">잔액 {customer.credits}P</p>
                      <button
                        onClick={() => selectCustomer(customer)}
                        className="rounded-md bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700"
                      >
                        주문 등록
                      </button>
                    </div>
                  </div>
                ))}
                {customers.length === 0 ? <p className="text-sm text-slate-500">등록된 고객이 없습니다.</p> : null}
              </div>
            </section>
          ) : null}

          {currentView === "템플릿 설정" ? (
            <TemplateSettings templates={templates} onSave={saveTemplateConfig} />
          ) : null}

          {currentView === "크레딧 충전" ? (
            <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-semibold">크레딧 충전</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_140px]">
                <label>
                  <p className="mb-1 text-xs font-semibold text-slate-500">사용자</p>
                  <select
                    value={creditUserId}
                    onChange={(event) => setCreditUserId(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">선택</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} ({customer.credits}P)
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <p className="mb-1 text-xs font-semibold text-slate-500">충전 포인트</p>
                  <input
                    type="number"
                    value={creditAmount}
                    onChange={(event) => setCreditAmount(Number(event.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <div className="flex items-end">
                  <button
                    onClick={chargeCredits}
                    className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    충전
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </main>
      </div>

      {showModal ? (
        <OrderModal
          form={form}
          onChange={setForm}
          onClose={() => setShowModal(false)}
          onSubmit={createOrder}
          isSubmitting={isSubmitting}
          serviceProducts={serviceProducts}
        />
      ) : null}
    </div>
  );
}

function toUiStatus(value: string): DashboardOrder["status"] {
  if (value === "queued") return "대기중";
  if (value === "processing") return "처리중";
  if (value === "failed") return "실패";
  return "완료";
}

function upsertTemplate(prev: TemplateConfig[], next: TemplateConfig) {
  const index = prev.findIndex(
    (item) => item.serviceId === next.serviceId && item.productId === next.productId
  );
  if (index < 0) {
    return [...prev, next];
  }
  return prev.map((item, idx) => (idx === index ? next : item));
}

function OrdersPanel(props: {
  orders: DashboardOrder[];
  onCopy: (order: DashboardOrder) => void;
  onDetail: (orderId: string) => void;
  onRegenerate: (order: DashboardOrder) => void;
  onResend: (order: DashboardOrder) => void;
}) {
  return (
    <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-3 text-lg font-semibold">주문 목록</h2>
      <div className="space-y-2">
        {props.orders.map((order) => (
          <div
            key={order.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
          >
            <div>
              <p className="font-semibold text-slate-900">{order.customerName}</p>
              <p className="text-xs text-slate-500">
                {serviceNameMap[order.serviceId]} | {productNameMap[order.productId]} | {order.llmModel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{order.status}</span>
              <button onClick={() => props.onCopy(order)} className="action-btn">
                복사
              </button>
              <button onClick={() => props.onDetail(order.id)} className="action-btn">
                상세보기
              </button>
              <button onClick={() => props.onRegenerate(order)} className="action-btn">
                재생성
              </button>
              <button onClick={() => props.onResend(order)} className="action-btn">
                이메일 재발송
              </button>
            </div>
          </div>
        ))}
        {props.orders.length === 0 ? <p className="text-sm text-slate-500">주문이 없습니다.</p> : null}
      </div>
    </section>
  );
}

function DetailPanel({ order }: { order: DashboardOrder | null }) {
  if (!order) {
    return (
      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold">리포트 상세</h2>
        <p className="mt-2 text-sm text-slate-500">주문 목록에서 상세보기를 눌러주세요.</p>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-semibold">리포트 상세 보기</h2>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-200 p-3">
          <h3 className="font-semibold">만세력 명식표 (한자 포함)</h3>
          <p className="mt-2 text-sm">년주: {order.chart.saju.yearPillar} ({order.chart.saju.yearPillarHanja})</p>
          <p className="text-sm">월주: {order.chart.saju.monthPillar} ({order.chart.saju.monthPillarHanja})</p>
          <p className="text-sm">일주: {order.chart.saju.dayPillar} ({order.chart.saju.dayPillarHanja})</p>
          <p className="text-sm">시주: {order.chart.saju.hourPillar ?? "미상"} ({order.chart.saju.hourPillarHanja ?? "-"})</p>
        </article>

        <article className="rounded-lg border border-slate-200 p-3">
          <h3 className="font-semibold">오행 그래프</h3>
          <ElementBars chart={order.chart} />
        </article>
      </div>

      <article className="mt-4 rounded-lg border border-slate-200 p-3">
        <h3 className="font-semibold">확장 만세력 정보</h3>
        <p className="mt-2 text-sm">신살: {order.chart.advanced.sinsal.join(", ")}</p>
        <p className="text-sm">지장간(월지): {order.chart.advanced.hiddenStems["월지"].join(", ")}</p>
        <p className="text-sm">
          대운: {order.chart.advanced.daeun.map((item) => `${item.age}세 ${item.pillar}`).join(" | ")}
        </p>
        <p className="text-sm">
          세운: {order.chart.advanced.saeun.map((item) => `${item.year} ${item.pillar}`).join(" | ")}
        </p>
      </article>

      <div className="mt-4 space-y-3">
        {order.analysis.map((section) => (
          <article key={section.title} className="rounded-lg border border-slate-200 p-3">
            <h3 className="font-semibold">{section.title}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{section.content}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function OrdersTable({ orders, onDetail }: { orders: DashboardOrder[]; onDetail: (orderId: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="px-2 py-2">고객</th>
            <th className="px-2 py-2">서비스</th>
            <th className="px-2 py-2">상품</th>
            <th className="px-2 py-2">모델</th>
            <th className="px-2 py-2">상태</th>
            <th className="px-2 py-2">액션</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b border-slate-100">
              <td className="px-2 py-2">{order.customerName}</td>
              <td className="px-2 py-2">{serviceNameMap[order.serviceId]}</td>
              <td className="px-2 py-2">{productNameMap[order.productId]}</td>
              <td className="px-2 py-2">{order.llmModel}</td>
              <td className="px-2 py-2">{order.status}</td>
              <td className="px-2 py-2">
                <button className="action-btn" onClick={() => onDetail(order.id)}>
                  상세보기
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TemplateSettings({ templates, onSave }: { templates: TemplateConfig[]; onSave: (config: TemplateConfig) => Promise<void> }) {
  const [editing, setEditing] = useState<TemplateConfig>(templates[0]);

  useEffect(() => {
    if (templates.length > 0) {
      setEditing(templates[0]);
    }
  }, [templates]);

  if (!editing) {
    return null;
  }

  return (
    <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-semibold">서비스별 템플릿/프롬프트 설정</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <SelectField
          label="서비스"
          value={editing.serviceId}
          onChange={(value) =>
            setEditing((prev) => ({
              ...prev,
              serviceId: value as ServiceId,
            }))
          }
          options={serviceIds.map((serviceId) => ({ value: serviceId, label: serviceNameMap[serviceId] }))}
        />

        <SelectField
          label="상품"
          value={editing.productId}
          onChange={(value) => setEditing((prev) => ({ ...prev, productId: value as ProductId }))}
          options={Object.values(productsByService).flat().map((productId) => ({
            value: productId,
            label: productNameMap[productId],
          }))}
        />

        <TextField
          label="표지 템플릿"
          value={editing.coverTemplate}
          onChange={(value) => setEditing((prev) => ({ ...prev, coverTemplate: value }))}
        />

        <TextField
          label="내지 템플릿"
          value={editing.innerTemplate}
          onChange={(value) => setEditing((prev) => ({ ...prev, innerTemplate: value }))}
        />

        <AreaField
          label="종합운 프롬프트"
          value={editing.promptOverall}
          onChange={(value) => setEditing((prev) => ({ ...prev, promptOverall: value }))}
        />
        <AreaField
          label="재물운 프롬프트"
          value={editing.promptWealth}
          onChange={(value) => setEditing((prev) => ({ ...prev, promptWealth: value }))}
        />
        <AreaField
          label="직업운 프롬프트"
          value={editing.promptCareer}
          onChange={(value) => setEditing((prev) => ({ ...prev, promptCareer: value }))}
        />
      </div>

      <div className="mt-4">
        <button onClick={() => void onSave(editing)} className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white">
          저장
        </button>
      </div>
    </section>
  );
}

function OrderModal(props: {
  form: FormState;
  onChange: React.Dispatch<React.SetStateAction<FormState>>;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  serviceProducts: readonly ProductId[];
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">새 주문 등록</h3>
          <button onClick={props.onClose} className="text-sm text-slate-500 hover:text-slate-800">
            닫기
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <TextField label="이름" value={props.form.customerName} onChange={(value) => props.onChange((prev) => ({ ...prev, customerName: value }))} />
          <TextField
            label="이메일"
            value={props.form.customerEmail}
            onChange={(value) => props.onChange((prev) => ({ ...prev, customerEmail: value }))}
          />

          <SelectField
            label="서비스"
            value={props.form.serviceId}
            onChange={(value) =>
              props.onChange((prev) => ({
                ...prev,
                serviceId: value as ServiceId,
                productId: productsByService[value as ServiceId][0],
              }))
            }
            options={serviceIds.map((serviceId) => ({ value: serviceId, label: serviceNameMap[serviceId] }))}
          />

          <SelectField
            label="상품"
            value={props.form.productId}
            onChange={(value) => props.onChange((prev) => ({ ...prev, productId: value as ProductId }))}
            options={props.serviceProducts.map((productId) => ({ value: productId, label: productNameMap[productId] }))}
          />

          <SelectField
            label="LLM"
            value={props.form.llmModel}
            onChange={(value) => props.onChange((prev) => ({ ...prev, llmModel: value as LlmModel }))}
            options={llmModels.map((model) => ({ value: model, label: model }))}
          />

          <SelectField
            label="성별"
            value={props.form.gender}
            onChange={(value) => props.onChange((prev) => ({ ...prev, gender: value as FormState["gender"] }))}
            options={[
              { value: "남성", label: "남성" },
              { value: "여성", label: "여성" },
              { value: "기타", label: "기타" },
            ]}
          />

          <div className="grid grid-cols-3 gap-2 md:col-span-2">
            <NumberField label="생년" value={props.form.year} onChange={(value) => props.onChange((prev) => ({ ...prev, year: value }))} />
            <NumberField label="월" value={props.form.month} onChange={(value) => props.onChange((prev) => ({ ...prev, month: value }))} />
            <NumberField label="일" value={props.form.day} onChange={(value) => props.onChange((prev) => ({ ...prev, day: value }))} />
          </div>

          <label className="md:col-span-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={props.form.birthTimeUnknown}
              onChange={(event) => props.onChange((prev) => ({ ...prev, birthTimeUnknown: event.target.checked }))}
            />
            출생 시간 모름
          </label>

          {!props.form.birthTimeUnknown ? (
            <div className="grid grid-cols-2 gap-2 md:col-span-2">
              <NumberField label="출생시" value={props.form.hour} onChange={(value) => props.onChange((prev) => ({ ...prev, hour: value }))} />
              <NumberField
                label="출생분"
                value={props.form.minute}
                onChange={(value) => props.onChange((prev) => ({ ...prev, minute: value }))}
              />
            </div>
          ) : null}

          <SelectField
            label="양력/음력"
            value={props.form.calendarType}
            onChange={(value) => props.onChange((prev) => ({ ...prev, calendarType: value as FormState["calendarType"] }))}
            options={[
              { value: "solar", label: "양력" },
              { value: "lunar", label: "음력" },
            ]}
          />

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={props.form.isLeapMonth}
              onChange={(event) => props.onChange((prev) => ({ ...prev, isLeapMonth: event.target.checked }))}
            />
            윤달
          </label>

          <AreaField
            label="추가 질문"
            value={props.form.additionalQuestion}
            onChange={(value) => props.onChange((prev) => ({ ...prev, additionalQuestion: value }))}
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={props.onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
            취소
          </button>
          <button
            onClick={props.onSubmit}
            disabled={props.isSubmitting}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {props.isSubmitting ? "처리중..." : "주문 생성"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ElementBars({ chart }: { chart: ReturnType<typeof computeChart> }) {
  const maxValue = Math.max(...Object.values(chart.fiveElements), 1);

  return (
    <div className="mt-3 space-y-2">
      {(["목", "화", "토", "금", "수"] as const).map((key) => {
        const value = chart.fiveElements[key];
        const width = Math.max(8, Math.round((value / maxValue) * 100));
        return (
          <div key={key} className="grid grid-cols-[24px_1fr_24px] items-center gap-2 text-sm">
            <span>{key}</span>
            <div className="h-2 rounded-full bg-violet-100">
              <div className="h-2 rounded-full bg-gradient-to-r from-violet-600 to-blue-500" style={{ width: `${width}%` }} />
            </div>
            <span>{value}</span>
          </div>
        );
      })}
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone: "slate" | "amber" | "blue" | "emerald" | "rose" }) {
  const toneMap = {
    slate: "text-slate-800",
    amber: "text-amber-600",
    blue: "text-blue-600",
    emerald: "text-emerald-600",
    rose: "text-rose-600",
  } as const;

  return (
    <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneMap[tone]}`}>{value}</p>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="md:col-span-1">
      <p className="mb-1 text-xs font-semibold text-slate-500">{label}</p>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      <p className="mb-1 text-xs font-semibold text-slate-500">{label}</p>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label>
      <p className="mb-1 text-xs font-semibold text-slate-500">{label}</p>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="md:col-span-2">
      <p className="mb-1 text-xs font-semibold text-slate-500">{label}</p>
      <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
    </label>
  );
}