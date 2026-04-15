export const APP_OPTIONS_SEEDS = {
  truck_types: [
    { name: 'Flatbed', description: 'Flatbed truck', status: 'ACTIVE' },
    { name: 'Lowbed', description: 'Lowbed truck', status: 'ACTIVE' },
    { name: 'Reefer', description: 'Reefer truck', status: 'ACTIVE' },
    { name: 'Arewa', description: 'Arewa truck', status: 'ACTIVE' },
    { name: 'Fish-Van', description: 'Fish-Van truck', status: 'ACTIVE' },
    { name: 'Special Truck', description: 'Special purpose truck', status: 'ACTIVE' },
  ],
  booking_categories: [
    { name: 'Import Container', status: 'ACTIVE' },
    { name: 'Export Container', status: 'ACTIVE' },
    { name: 'Empty Container', status: 'ACTIVE' },
    { name: 'Import Non-Containerized', status: 'ACTIVE' },
    { name: 'Export Non-Containerized', status: 'ACTIVE' },
    { name: 'FMCG (Non-Port)', status: 'ACTIVE' },
  ],
  tep_types: [
    { name: 'Import TDO', status: 'ACTIVE' },
    { name: 'Export TDO', status: 'ACTIVE' },
    { name: 'Empty TDO', status: 'ACTIVE' },
    { name: 'GatePass (Port)', status: 'ACTIVE' },
    { name: 'GatePass (Non-Port)', status: 'ACTIVE' },
  ],
  park_types: [
    { name: 'Bonded Terminal', status: 'ACTIVE' },
    { name: 'Truck Park', status: 'ACTIVE' },
    { name: 'Fish-Van Park', status: 'ACTIVE' },
    { name: 'Pregate', status: 'ACTIVE' },
    { name: 'EPT', status: 'ACTIVE' },
  ],
  facility_types: [
    { name: 'Facility', status: 'ACTIVE' },
    { name: 'Facility-Pregate', status: 'ACTIVE' },
  ],
  facility_timeslots: [
    {
      name: 'Midnight Window',
      start_time: '00:00:00',
      end_time: '03:59:59',
      status: 'ACTIVE',
    },
    {
      name: 'Early Morning Window',
      start_time: '04:00:00',
      end_time: '07:59:59',
      status: 'ACTIVE',
    },
    {
      name: 'Morning Window',
      start_time: '08:00:00',
      end_time: '11:59:59',
      status: 'ACTIVE',
    },
    {
      name: 'Afternoon Window',
      start_time: '12:00:00',
      end_time: '15:59:59',
      status: 'ACTIVE',
    },
    {
      name: 'Evening Window',
      start_time: '16:00:00',
      end_time: '19:59:59',
      status: 'ACTIVE',
    },
    {
      name: 'Night Window',
      start_time: '20:00:00',
      end_time: '23:59:59',
      status: 'ACTIVE',
    },
  ],
};
