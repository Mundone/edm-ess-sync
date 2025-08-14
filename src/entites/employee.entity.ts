// src/entities/employee.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany } from 'typeorm';
import { EmployeeEmployment } from './employee-employment.entity';

@Entity('employee')
export class Employee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'erp_code', unique: true })
  erpCode: string;

  @Column({ name: 'registration_number', nullable: true })
  registrationNumber: string;

  @Column({ name: 'firstname' })
  firstname: string;

  @Column({ name: 'lastname' })
  lastname: string;

  @Column({ name: 'employee_phone_1', nullable: true })
  employeePhone1: string;

  @Column({ name: 'employee_phone_2', nullable: true })
  employeePhone2: string;

  @Column({ name: 'email', nullable: true })
  email: string;

  @Column({ name: 'gender', nullable: true })
  gender: string;

  @Column({ name: 'company_enrolled_date', type: 'date', nullable: true })
  companyEnrolledDate: Date;

  @Column({ name: 'mmc_first_enrolled_date', type: 'date', nullable: true })
  mmcFirstEnrolledDate: Date;

  @Column({ name: 'emergency_contact_name', nullable: true })
  emergencyContactName: string;

  @Column({ name: 'emergency_contact_phone', nullable: true })
  emergencyContactPhone: string;

  @Column({ name: 'portrait_image', nullable: true })
  portraitImage: string;

  @Column({ name: 'portrait_image_fallback', nullable: true })
  portraitImageFallback: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  @OneToMany(() => EmployeeEmployment, employment => employment.employee)
  employments: EmployeeEmployment[];
}