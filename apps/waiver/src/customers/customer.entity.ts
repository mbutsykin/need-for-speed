import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

/**
 * One registered person — leader or companion. The party/group is not stored;
 * a minor's `guardianId` points at the leader who vouched for them.
 * See docs/superpowers/specs/2026-07-18-waiver-persistence-design.md.
 */
@Entity("customers")
export class Customer {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("text")
  name!: string;

  /** Canonical ISO date, YYYY-MM-DD. */
  @Column("date")
  birthday!: string;

  @Column({ type: "text", nullable: true })
  phone!: string | null;

  @Column({ type: "text", nullable: true })
  email!: string | null;

  /** Marketing consent — the leader's answer, copied onto every party member. */
  @Column("boolean")
  consent!: boolean;

  /** Extensible handles, e.g. `{ telegram }`. Only the account holder has one. */
  @Column("jsonb")
  social!: { telegram?: string };

  /** The leader's id when this person is a minor companion; null otherwise. */
  @Column({ type: "uuid", name: "guardian_id", nullable: true })
  guardianId!: string | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}
