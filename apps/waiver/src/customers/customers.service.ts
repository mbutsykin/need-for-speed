import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, type EntityManager } from "typeorm";

import type { Participant } from "../chat-bot/scenes/intake/types";

import { Customer } from "./customer.entity";
import { insertGroup, toCustomerRows, type CustomerRow } from "./registration";

@Injectable()
export class CustomersService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Persists a completed intake party in one transaction, so a partial group is
   * never written. The leader is inserted first; minor companions are then
   * linked to the leader's id.
   */
  async registerGroup(participants: Participant[]): Promise<void> {
    const rows = toCustomerRows(participants);

    if (rows.length === 0) return;

    await this.dataSource.transaction((manager) =>
      insertGroup(rows, (row, guardianId) => this.insert(manager, row, guardianId)),
    );
  }

  private async insert(
    manager: EntityManager,
    row: CustomerRow,
    guardianId: string | null,
  ): Promise<string> {
    const customer = manager.create(Customer, {
      name: row.name,
      birthday: row.birthday,
      phone: row.phone,
      email: row.email,
      consent: row.consent,
      social: row.social,
      guardianId,
    });

    const saved = await manager.save(customer);

    return saved.id;
  }
}
