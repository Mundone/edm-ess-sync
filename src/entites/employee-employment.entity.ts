// src/entities/employee-employment.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Employee } from './employee.entity';

@Entity('employee_employment')
export class EmployeeEmployment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'erp_code', unique: true })
  erpCode: string;

  @Column({ name: 'employee_id' })
  employeeId: number;

  @Column({ name: 'grade', nullable: true })
  grade: string;

  @Column({ name: 'commute_from', nullable: true })
  commuteFrom: string;

  @Column({ name: 'vehicle_type', nullable: true })
  vehicleType: string;

  @Column({ name: 'work_location', nullable: true })
  workLocation: string;

  @Column({ name: 'roster_schedule', nullable: true })
  rosterSchedule: string;

  @Column({ name: 'roster_type', nullable: true })
  rosterType: string;

  @Column({ name: 'company', nullable: true })
  company: string;

  @Column({ name: 'unit', nullable: true })
  unit: string;

  @Column({ name: 'unit_abbr', nullable: true })
  unitAbbr: string;

  @Column({ name: 'unit_abbr2', nullable: true })
  unitAbbr2: string;

  @Column({ name: 'code', nullable: true })
  code: string;

  @Column({ name: 'subsection', nullable: true })
  subsection: string;

  @Column({ name: 'subsection_abbr', nullable: true })
  subsectionAbbr: string;

  @Column({ name: 'section', nullable: true })
  section: string;

  @Column({ name: 'section_abbr', nullable: true })
  sectionAbbr: string;

  @Column({ name: 'section_mn', nullable: true })
  sectionMn: string;

  @Column({ name: 'department', nullable: true })
  department: string;

  @Column({ name: 'department_abbr', nullable: true })
  departmentAbbr: string;

  @Column({ name: 'division', nullable: true })
  division: string;

  @Column({ name: 'position', nullable: true })
  position: string;

  @Column({ name: 'position_type', nullable: true })
  positionType: string;

  @Column({ name: 'is_roster', type: 'boolean', default: false })
  isRoster: boolean;

  @Column({ name: 'working_condition', nullable: true })
  workingCondition: string;

  @Column({ name: 'employee_status', nullable: true })
  employeeStatus: string;

  @Column({ name: 'employment_condition', nullable: true })
  employmentCondition: string;

  @Column({ name: 'is_uhg_camp_resident', type: 'boolean', default: false })
  isUhgCampResident: boolean;

  @Column({ name: 'is_tkh_camp_resident', type: 'boolean', default: false })
  isTkhCampResident: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  @ManyToOne(() => Employee, employee => employee.employments)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;
}