from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery("p2p_escrow", broker=settings.redis_url, backend=settings.redis_url)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

celery_app.conf.beat_schedule = {
    "sync-bsc-events": {
        "task": "app.workers.event_listener.sync_events",
        "schedule": 15.0,  # every 15 seconds
    },
    "check-timeouts": {
        "task": "app.workers.timeout_checker.check_timeouts",
        "schedule": 60.0,  # every minute
    },
    "cleanup-nonces": {
        "task": "app.workers.maintenance.cleanup_expired_nonces",
        "schedule": crontab(minute="*/5"),
    },
    "recalculate-tiers": {
        "task": "app.workers.maintenance.recalculate_tiers",
        "schedule": crontab(hour="*/6", minute="0"),
    },
}

celery_app.autodiscover_tasks(["app.workers"])
