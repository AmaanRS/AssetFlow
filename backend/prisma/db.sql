-- CreateTable
CREATE TABLE `users` (
    `user_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `department_id` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Active',
    `session_version` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_department_id_idx`(`department_id`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `password_reset_token_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`password_reset_token_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `department_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `head_user_id` INTEGER NULL,
    `parent_department_id` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `departments_name_key`(`name`),
    INDEX `departments_head_user_id_idx`(`head_user_id`),
    INDEX `departments_parent_department_id_idx`(`parent_department_id`),
    PRIMARY KEY (`department_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_categories` (
    `category_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `custom_fields` JSON NULL,

    UNIQUE INDEX `asset_categories_name_key`(`name`),
    PRIMARY KEY (`category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assets` (
    `asset_id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_tag` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `serial_number` VARCHAR(191) NULL,
    `category_id` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `condition` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `acquisition_date` DATETIME(3) NULL,
    `acquisition_cost` DECIMAL(12, 2) NULL,
    `photo_url` TEXT NULL,
    `custom_values` JSON NULL,
    `is_shared_resource` BOOLEAN NOT NULL DEFAULT false,
    `current_holder_user_id` INTEGER NULL,
    `current_holder_department_id` INTEGER NULL,
    `registered_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `assets_asset_tag_key`(`asset_tag`),
    INDEX `assets_category_id_idx`(`category_id`),
    INDEX `assets_current_holder_user_id_idx`(`current_holder_user_id`),
    INDEX `assets_current_holder_department_id_idx`(`current_holder_department_id`),
    INDEX `assets_registered_by_idx`(`registered_by`),
    INDEX `assets_status_idx`(`status`),
    PRIMARY KEY (`asset_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_allocations` (
    `allocation_id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NOT NULL,
    `allocated_to_user_id` INTEGER NULL,
    `allocated_to_department_id` INTEGER NULL,
    `allocated_by` INTEGER NOT NULL,
    `allocated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expected_return_date` DATETIME(3) NULL,
    `returned_at` DATETIME(3) NULL,
    `check_in_notes` TEXT NULL,
    `return_condition` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,

    INDEX `asset_allocations_asset_id_status_idx`(`asset_id`, `status`),
    INDEX `asset_allocations_allocated_to_user_id_idx`(`allocated_to_user_id`),
    INDEX `asset_allocations_allocated_to_department_id_idx`(`allocated_to_department_id`),
    INDEX `asset_allocations_allocated_by_idx`(`allocated_by`),
    PRIMARY KEY (`allocation_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transfer_requests` (
    `transfer_request_id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NOT NULL,
    `from_user_id` INTEGER NULL,
    `from_department_id` INTEGER NULL,
    `to_user_id` INTEGER NULL,
    `to_department_id` INTEGER NULL,
    `requested_by` INTEGER NOT NULL,
    `approved_by` INTEGER NULL,
    `reason` TEXT NULL,
    `status` VARCHAR(191) NOT NULL,
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approved_at` DATETIME(3) NULL,

    INDEX `transfer_requests_asset_id_status_idx`(`asset_id`, `status`),
    INDEX `transfer_requests_from_user_id_idx`(`from_user_id`),
    INDEX `transfer_requests_from_department_id_idx`(`from_department_id`),
    INDEX `transfer_requests_to_user_id_idx`(`to_user_id`),
    INDEX `transfer_requests_to_department_id_idx`(`to_department_id`),
    INDEX `transfer_requests_requested_by_idx`(`requested_by`),
    INDEX `transfer_requests_approved_by_idx`(`approved_by`),
    PRIMARY KEY (`transfer_request_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bookings` (
    `booking_id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `purpose` VARCHAR(191) NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bookings_asset_id_status_start_time_end_time_idx`(`asset_id`, `status`, `start_time`, `end_time`),
    INDEX `bookings_user_id_idx`(`user_id`),
    PRIMARY KEY (`booking_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_requests` (
    `maintenance_request_id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset_id` INTEGER NOT NULL,
    `raised_by_user_id` INTEGER NOT NULL,
    `approved_by_user_id` INTEGER NULL,
    `technician_user_id` INTEGER NULL,
    `description` TEXT NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'Medium',
    `photo_url` TEXT NULL,
    `resolution_notes` TEXT NULL,
    `status` VARCHAR(191) NOT NULL,
    `raised_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approved_at` DATETIME(3) NULL,
    `work_started_at` DATETIME(3) NULL,
    `work_completed_at` DATETIME(3) NULL,

    INDEX `maintenance_requests_asset_id_status_idx`(`asset_id`, `status`),
    INDEX `maintenance_requests_raised_by_user_id_idx`(`raised_by_user_id`),
    INDEX `maintenance_requests_approved_by_user_id_idx`(`approved_by_user_id`),
    INDEX `maintenance_requests_technician_user_id_idx`(`technician_user_id`),
    PRIMARY KEY (`maintenance_request_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_cycles` (
    `audit_cycle_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `scope_department_id` INTEGER NULL,
    `scope_location` VARCHAR(191) NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_cycles_status_start_date_end_date_idx`(`status`, `start_date`, `end_date`),
    PRIMARY KEY (`audit_cycle_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_assignments` (
    `audit_assignment_id` INTEGER NOT NULL AUTO_INCREMENT,
    `audit_cycle_id` INTEGER NOT NULL,
    `auditor_user_id` INTEGER NOT NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(191) NOT NULL,

    INDEX `audit_assignments_auditor_user_id_status_idx`(`auditor_user_id`, `status`),
    UNIQUE INDEX `audit_assignments_audit_cycle_id_auditor_user_id_key`(`audit_cycle_id`, `auditor_user_id`),
    PRIMARY KEY (`audit_assignment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_verifications` (
    `verification_id` INTEGER NOT NULL AUTO_INCREMENT,
    `audit_cycle_id` INTEGER NOT NULL,
    `asset_id` INTEGER NOT NULL,
    `auditor_user_id` INTEGER NOT NULL,
    `verified_status` VARCHAR(191) NOT NULL,
    `remarks` TEXT NULL,
    `verified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `asset_verifications_asset_id_idx`(`asset_id`),
    INDEX `asset_verifications_auditor_user_id_idx`(`auditor_user_id`),
    UNIQUE INDEX `asset_verifications_audit_cycle_id_asset_id_key`(`audit_cycle_id`, `asset_id`),
    PRIMARY KEY (`verification_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `discrepancy_reports` (
    `report_id` INTEGER NOT NULL AUTO_INCREMENT,
    `audit_cycle_id` INTEGER NOT NULL,
    `summary` TEXT NOT NULL,
    `details` JSON NULL,
    `status` VARCHAR(191) NOT NULL,
    `generated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `discrepancy_reports_audit_cycle_id_status_idx`(`audit_cycle_id`, `status`),
    PRIMARY KEY (`report_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `notification_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `link_path` VARCHAR(191) NULL,
    `read_status` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_read_status_created_at_idx`(`user_id`, `read_status`, `created_at`),
    PRIMARY KEY (`notification_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `log_id` INTEGER NOT NULL AUTO_INCREMENT,
    `actor_user_id` INTEGER NOT NULL,
    `action_type` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` INTEGER NOT NULL,
    `details` TEXT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activity_logs_actor_user_id_timestamp_idx`(`actor_user_id`, `timestamp`),
    INDEX `activity_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    PRIMARY KEY (`log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`department_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_head_user_id_fkey` FOREIGN KEY (`head_user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_parent_department_id_fkey` FOREIGN KEY (`parent_department_id`) REFERENCES `departments`(`department_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `asset_categories`(`category_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_current_holder_department_id_fkey` FOREIGN KEY (`current_holder_department_id`) REFERENCES `departments`(`department_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_current_holder_user_id_fkey` FOREIGN KEY (`current_holder_user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_registered_by_fkey` FOREIGN KEY (`registered_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_allocations` ADD CONSTRAINT `asset_allocations_allocated_by_fkey` FOREIGN KEY (`allocated_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_allocations` ADD CONSTRAINT `asset_allocations_allocated_to_department_id_fkey` FOREIGN KEY (`allocated_to_department_id`) REFERENCES `departments`(`department_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_allocations` ADD CONSTRAINT `asset_allocations_allocated_to_user_id_fkey` FOREIGN KEY (`allocated_to_user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_allocations` ADD CONSTRAINT `asset_allocations_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`asset_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfer_requests` ADD CONSTRAINT `transfer_requests_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfer_requests` ADD CONSTRAINT `transfer_requests_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`asset_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfer_requests` ADD CONSTRAINT `transfer_requests_from_department_id_fkey` FOREIGN KEY (`from_department_id`) REFERENCES `departments`(`department_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfer_requests` ADD CONSTRAINT `transfer_requests_from_user_id_fkey` FOREIGN KEY (`from_user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfer_requests` ADD CONSTRAINT `transfer_requests_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfer_requests` ADD CONSTRAINT `transfer_requests_to_department_id_fkey` FOREIGN KEY (`to_department_id`) REFERENCES `departments`(`department_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfer_requests` ADD CONSTRAINT `transfer_requests_to_user_id_fkey` FOREIGN KEY (`to_user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`asset_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_requests` ADD CONSTRAINT `maintenance_requests_approved_by_user_id_fkey` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_requests` ADD CONSTRAINT `maintenance_requests_technician_user_id_fkey` FOREIGN KEY (`technician_user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_requests` ADD CONSTRAINT `maintenance_requests_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`asset_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_requests` ADD CONSTRAINT `maintenance_requests_raised_by_user_id_fkey` FOREIGN KEY (`raised_by_user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_assignments` ADD CONSTRAINT `audit_assignments_audit_cycle_id_fkey` FOREIGN KEY (`audit_cycle_id`) REFERENCES `audit_cycles`(`audit_cycle_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_assignments` ADD CONSTRAINT `audit_assignments_auditor_user_id_fkey` FOREIGN KEY (`auditor_user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_verifications` ADD CONSTRAINT `asset_verifications_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`asset_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_verifications` ADD CONSTRAINT `asset_verifications_audit_cycle_id_fkey` FOREIGN KEY (`audit_cycle_id`) REFERENCES `audit_cycles`(`audit_cycle_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_verifications` ADD CONSTRAINT `asset_verifications_auditor_user_id_fkey` FOREIGN KEY (`auditor_user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `discrepancy_reports` ADD CONSTRAINT `discrepancy_reports_audit_cycle_id_fkey` FOREIGN KEY (`audit_cycle_id`) REFERENCES `audit_cycles`(`audit_cycle_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
