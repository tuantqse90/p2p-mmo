from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import UserTier
from app.models.user import UserProfile


async def update_trade_counts(
    buyer_wallet: str, seller_wallet: str, db: AsyncSession
) -> None:
    for wallet, is_buyer in [(buyer_wallet, True), (seller_wallet, False)]:
        result = await db.execute(select(UserProfile).where(UserProfile.wallet == wallet))
        user = result.scalar_one_or_none()
        if user is None:
            continue

        user.total_trades += 1
        if is_buyer:
            user.total_as_buyer += 1
        else:
            user.total_as_seller += 1

        # Update tier based on total trades
        if user.total_trades >= 50:
            user.tier = UserTier.TRUSTED
        elif user.total_trades >= 5:
            user.tier = UserTier.STANDARD

    await db.flush()
