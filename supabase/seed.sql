insert into public.categories (id, name, sort_order) values
  (1,'Hamburguesas',1),
  (2,'Tortas',2),
  (3,'Papas',3),
  (4,'Alitas',4),
  (5,'Snacks',5)
on conflict do nothing;

insert into public.products (id, category_id, name, description, price_cents, station, is_available, sort_order) values
  (1,1,'Hamburguesa clásica','',9900,'PLANCHA',true,1),
  (2,1,'Hamburguesa doble','',12900,'PLANCHA',true,2),
  (3,2,'Torta de res','',10900,'PLANCHA',true,1),
  (4,3,'Papas','',4500,'FREIDORA',true,1),
  (5,4,'Alitas','',9900,'FREIDORA',true,1),
  (6,5,'Dedos de queso','',7900,'FREIDORA',true,1),
  (7,5,'Aros de cebolla','',6900,'FREIDORA',true,2)
on conflict do nothing;
