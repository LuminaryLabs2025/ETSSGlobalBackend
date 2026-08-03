import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../database/entities/company.entity';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { MARITIME_ETSS_COMPANY_NAME } from '../../common/constants/companies';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  /**
   * Ensures the platform company used for SYSTEM user accounts exists.
   * Idempotent — safe to call on every system-user create.
   */
  async ensureMaritimeEtssCompany(): Promise<Company> {
    let company = await this.companyRepository.findOne({
      where: { name: MARITIME_ETSS_COMPANY_NAME },
    });
    if (!company) {
      company = await this.companyRepository.save(
        this.companyRepository.create({
          name: MARITIME_ETSS_COMPANY_NAME,
          is_active: true,
        }),
      );
    }
    return company;
  }

  async findAll(): Promise<Company[]> {
    return this.companyRepository.find({
      relations: ['users', 'user_type'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Company> {
    const company = await this.companyRepository.findOne({
      where: { id },
      relations: ['users', 'user_type'],
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  async update(
    id: string,
    updateCompanyDto: UpdateCompanyDto,
  ): Promise<Company> {
    const company = await this.findOne(id);
    Object.assign(company, updateCompanyDto);
    return this.companyRepository.save(company);
  }

  async remove(id: string): Promise<void> {
    const company = await this.findOne(id);
    await this.companyRepository.remove(company);
  }
}
