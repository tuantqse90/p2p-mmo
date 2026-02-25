import { OrderStatus } from "@/lib/types";

interface TimelineStep {
  label: string;
  completed: boolean;
  active: boolean;
  failed?: boolean;
}

function getSteps(status: OrderStatus): TimelineStep[] {
  const steps: TimelineStep[] = [
    {
      label: "Order Created",
      completed: true,
      active: status === OrderStatus.CREATED,
    },
    {
      label: "Seller Confirmed",
      completed: [
        OrderStatus.SELLER_CONFIRMED,
        OrderStatus.COMPLETED,
        OrderStatus.DISPUTED,
        OrderStatus.RESOLVED_BUYER,
        OrderStatus.RESOLVED_SELLER,
      ].includes(status),
      active: status === OrderStatus.SELLER_CONFIRMED,
    },
    {
      label: "Completed",
      completed: [
        OrderStatus.COMPLETED,
        OrderStatus.RESOLVED_BUYER,
        OrderStatus.RESOLVED_SELLER,
      ].includes(status),
      active: status === OrderStatus.COMPLETED,
    },
  ];

  if (
    status === OrderStatus.DISPUTED ||
    status === OrderStatus.RESOLVED_BUYER ||
    status === OrderStatus.RESOLVED_SELLER
  ) {
    steps.push({
      label: "Disputed",
      completed: [
        OrderStatus.RESOLVED_BUYER,
        OrderStatus.RESOLVED_SELLER,
      ].includes(status),
      active: status === OrderStatus.DISPUTED,
      failed: true,
    });
    if (
      status === OrderStatus.RESOLVED_BUYER ||
      status === OrderStatus.RESOLVED_SELLER
    ) {
      steps.push({
        label:
          status === OrderStatus.RESOLVED_BUYER
            ? "Resolved (Buyer wins)"
            : "Resolved (Seller wins)",
        completed: true,
        active: true,
      });
    }
  }

  if (status === OrderStatus.CANCELLED) {
    steps[steps.length - 1] = {
      label: "Cancelled",
      completed: true,
      active: true,
      failed: true,
    };
  }

  if (status === OrderStatus.EXPIRED) {
    steps[steps.length - 1] = {
      label: "Expired",
      completed: true,
      active: true,
      failed: true,
    };
  }

  return steps;
}

export function OrderTimeline({ status }: { status: OrderStatus }) {
  const steps = getSteps(status);

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div
              className={`w-3 h-3 rounded-full ${
                step.failed
                  ? "bg-danger"
                  : step.completed
                  ? "bg-success"
                  : step.active
                  ? "bg-primary"
                  : "bg-border"
              }`}
            />
            <span
              className={`text-xs mt-1 whitespace-nowrap ${
                step.active ? "text-foreground font-medium" : "text-muted"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 w-8 mt-[-14px] ${
                step.completed ? "bg-success" : "bg-border"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
