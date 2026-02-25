from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Application
    app_env: str = "development"
    app_debug: bool = False
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    # Database
    database_url: str = "postgresql+asyncpg://p2p:p2p@localhost:5432/p2p_escrow"
    database_pool_size: int = 20
    database_max_overflow: int = 10

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 24

    @model_validator(mode="after")
    def _enforce_jwt_secret_in_production(self) -> "Settings":
        if self.app_env == "production" and self.jwt_secret_key == "change-me-in-production":
            raise ValueError("JWT_SECRET_KEY must be changed from default in production")
        return self

    # BSC
    bsc_rpc_url: str = "https://bsc-dataseed1.binance.org"
    bsc_chain_id: int = 56
    bsc_block_confirmations: int = 15

    # Contract Addresses
    escrow_contract_address: str = ""
    arbitrator_pool_address: str = ""
    usdt_address: str = "0x55d398326f99059fF775485246999027B3197955"
    usdc_address: str = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"

    # IPFS (Pinata)
    pinata_api_key: str = ""
    pinata_secret_key: str = ""
    pinata_gateway_url: str = "https://gateway.pinata.cloud/ipfs/"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    # Rate Limiting
    rate_limit_per_minute: int = 100
    auth_rate_limit_per_minute: int = 10
    trusted_proxy: bool = False

    model_config = {"env_file": ".env", "case_sensitive": False}


settings = Settings()
