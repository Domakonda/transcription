.PHONY: help install build clean test lint deploy destroy

help: ## Display this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	yarn install

build: ## Build TypeScript code
	yarn build

clean: ## Clean build artifacts
	yarn clean

test: ## Run tests
	yarn test

lint: ## Run ESLint
	yarn lint

lint-fix: ## Fix ESLint issues
	yarn lint:fix

package: ## Package Lambda functions
	yarn package

# Terraform commands
tf-init: ## Initialize Terraform
	cd terraform && terraform init

tf-plan: ## Run Terraform plan
	cd terraform && terraform plan

tf-apply: ## Apply Terraform changes
	cd terraform && terraform apply

tf-destroy: ## Destroy Terraform resources
	cd terraform && terraform destroy

# SAM commands
sam-build: ## Build with SAM
	sam build

sam-local-api: ## Start SAM local API
	sam local start-api

sam-invoke: ## Invoke Lambda locally
	sam local invoke

# Development workflow
dev-setup: install build tf-init ## Complete development setup

deploy: build tf-apply ## Build and deploy to AWS

# Quick commands
all: install build test ## Install, build, and test

.DEFAULT_GOAL := help
