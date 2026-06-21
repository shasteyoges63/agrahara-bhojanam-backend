-- Agrahara Bhojanam backend MySQL schema
-- Database name: agrahara_abdatabase
--
-- Run this in cPanel/phpMyAdmin:
-- 1. Open phpMyAdmin
-- 2. Select database agrahara_abdatabase
-- 3. Open the SQL tab
-- 4. Paste and run this file
 
CREATE DATABASE IF NOT EXISTS `agrahara_abdatabase`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
 
USE `agrahara_abdatabase`;
 
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(32) NOT NULL,
  `phone_digits` VARCHAR(32) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `role` VARCHAR(32) NOT NULL DEFAULT 'customer',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_phone_digits` (`phone_digits`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
CREATE TABLE IF NOT EXISTS `products` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `cost_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `category` VARCHAR(128) DEFAULT NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `stock` INT NOT NULL DEFAULT 0,
  `traditional_benefit` TEXT DEFAULT NULL,
  `weight` VARCHAR(64) DEFAULT NULL,
  `ingredients` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_products_category` (`category`),
  KEY `idx_products_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
CREATE TABLE IF NOT EXISTS `product_images` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` VARCHAR(64) NOT NULL,
  `image_url` TEXT NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_product_images_product` (`product_id`),
  CONSTRAINT `fk_product_images_product`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
CREATE TABLE IF NOT EXISTS `orders` (
  `id` VARCHAR(64) NOT NULL,
  `customer_name` VARCHAR(191) NOT NULL,
  `customer_email` VARCHAR(191) DEFAULT NULL,
  `customer_phone` VARCHAR(32) DEFAULT NULL,
  `customer_address` TEXT DEFAULT NULL,
  `total_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `order_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` VARCHAR(64) NOT NULL DEFAULT 'Pending',
  `payment_method` VARCHAR(64) DEFAULT NULL,
  `payment_status` VARCHAR(64) DEFAULT NULL,
  `invoice_number` VARCHAR(64) DEFAULT NULL,
  `whatsapp_sent` TINYINT(1) NOT NULL DEFAULT 0,
  `email_sent` TINYINT(1) NOT NULL DEFAULT 0,
  `delivery_city` VARCHAR(128) DEFAULT NULL,
  `delivery_state` VARCHAR(128) DEFAULT NULL,
  `delivery_region` VARCHAR(64) DEFAULT NULL,
  `latitude` DECIMAL(10,7) DEFAULT NULL,
  `longitude` DECIMAL(10,7) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_orders_order_date` (`order_date`),
  KEY `idx_orders_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` VARCHAR(64) NOT NULL,
  `product_id` VARCHAR(64) DEFAULT NULL,
  `product_name` VARCHAR(191) NOT NULL,
  `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `cost_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `quantity` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order` (`order_id`),
  KEY `idx_order_items_product` (`product_id`),
  CONSTRAINT `fk_order_items_order`
    FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_order_items_product`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
CREATE TABLE IF NOT EXISTS `expenses` (
  `id` VARCHAR(64) NOT NULL,
  `month` VARCHAR(7) DEFAULT NULL,
  `category` VARCHAR(128) DEFAULT NULL,
  `amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `description` TEXT DEFAULT NULL,
  `date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_expenses_date` (`date`),
  KEY `idx_expenses_month` (`month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
CREATE TABLE IF NOT EXISTS `contact_messages` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(191) DEFAULT NULL,
  `email` VARCHAR(191) DEFAULT NULL,
  `phone` VARCHAR(32) DEFAULT NULL,
  `subject` VARCHAR(191) DEFAULT NULL,
  `message` TEXT DEFAULT NULL,
  `date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contact_messages_date` (`date`),
  KEY `idx_contact_messages_resolved` (`resolved`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
CREATE TABLE IF NOT EXISTS `smtp_config` (
  `id` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `host` VARCHAR(191) NOT NULL DEFAULT 'smtp.gmail.com',
  `port` INT NOT NULL DEFAULT 465,
  `secure` TINYINT(1) NOT NULL DEFAULT 1,
  `username` VARCHAR(191) DEFAULT NULL,
  `sender_email` VARCHAR(191) DEFAULT NULL,
  `password` TEXT DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
CREATE TABLE IF NOT EXISTS `whatsapp_config` (
  `id` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `api_key` TEXT DEFAULT NULL,
  `phone_id` VARCHAR(191) DEFAULT NULL,
  `routing_mode` VARCHAR(64) DEFAULT 'DirectWeb',
  `recipient_number` VARCHAR(32) DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
 
-- Compatibility table for the current backend adapter.
-- Keep this table until the backend routes are fully changed to use the normalized tables above.
CREATE TABLE IF NOT EXISTS `app_documents` (
  `collection_name` VARCHAR(64) NOT NULL,
  `document_id` VARCHAR(191) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`collection_name`, `document_id`),
  KEY `idx_app_documents_collection` (`collection_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;